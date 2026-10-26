# Stok Bahan & Resep per Porsi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Branch admins can add ingredients and stock; every portal order consumes recipe ingredients per portion atomically, with cancellation restoring stock.

**Architecture:** A new `menu_ingredients` recipe table feeds a security-definer consumption helper called inside `portal_create_order`. An `order_ingredient_usage` ledger makes cancellation restore exact quantities. The frontend only edits recipes/inventory through RLS-protected tables and existing AppContext operations; it never computes or sends stock deductions.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Supabase Postgres/RLS/PLpgSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-26-stok-resep-design.md`

## Global Constraints

- No service-role key or secret in frontend code.
- Stock deduction must happen inside the database transaction; never trust browser-supplied stock quantities or customer IDs.
- Recipe quantities are per portion; order quantity multiplies them.
- Missing inventory row = skip that ingredient. Existing inventory row with mismatched unit or insufficient stock = reject the order.
- Cancellation restores each ledger row exactly once.
- Do not modify order prices, quantities, payments, or statuses beyond stock consumption/restoration.
- Use `nnorte-*` theme tokens; do not hard-code hex colours.
- Keep existing rating, checkout, cashier, kitchen, multi-branch, QR, cart, and tracking flows working.
- Indonesian UI copy.

## Review Focus

- Recipe unit `kg` vs inventory unit `gram`: order must fail with a clear message, not silently deduct wrong units.
- Ingredient exists in recipe but not inventory: order must still succeed and create no usage row.
- Order quantity > 1: deduction must be `quantity_per_portion × order_quantity`.
- Insufficient configured stock: entire order must roll back, not go negative or leave a partial order.
- Cancellation repeated: stock must be restored once, not twice.

---

### Task 1: Database recipe, stock ledger, and portal consumption

**Files:**
- Create: `supabase/migrations/202610260003_stock_recipe.sql`
- Create: `supabase/tests/stock_recipe_test.sql`

**Interfaces:**
- Consumes: existing `orders`, `order_items`, `menu_items`, `inventory_items`, `portal_create_order`.
- Produces:
  - `public.menu_ingredients(id, restaurant_id, menu_item_id, name, quantity, unit, created_at, updated_at)`
  - `public.order_ingredient_usage(id, order_id, order_item_id, inventory_item_id, ingredient_name, quantity, unit, restored_at)`
  - `public.consume_order_ingredients(p_order_id uuid) returns void`
  - `public.restore_order_ingredients(p_order_id uuid) returns void`
  - trigger `orders_restore_ingredients_on_cancel`
  - `menu_items.allergens text[]`

- [ ] **Step 1: Write the failing SQL regression test**

Create `supabase/tests/stock_recipe_test.sql` inside `begin; ... rollback;` with fixtures:
- restaurant `aaaaaaaa-...`, branch `bbbbbbbb-...`, menu `cccccccc-...`, branch menu row, inventory `Kentang` 10 kg, `Ayam` 5 pcs, recipe `Kentang 0.2 kg`, `Ayam 1 pcs`.
- Call `portal_create_order` for 2 portions.
- Assert stock `Kentang = 9.6`, `Ayam = 3`, two usage rows.
- Cancel the order; assert stock `10` and `5`, `restored_at` set; cancel again; assert unchanged.
- Assert insufficient stock raises and creates no order; unit mismatch raises and creates no order; a recipe ingredient without inventory is skipped.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx supabase db query --linked --file supabase/tests/stock_recipe_test.sql`
Expected: FAIL because `public.menu_ingredients` does not exist.

- [ ] **Step 3: Implement the migration**

Create `supabase/migrations/202610260003_stock_recipe.sql`:
- Add `menu_items.allergens`.
- Add unique index on `inventory_items (branch_id, lower(btrim(name)))`.
- Create `menu_ingredients` with composite FK to `menu_items(restaurant_id, id)`, unique `(menu_item_id, lower(name))`, checks, updated-at trigger, RLS read for members, manage for owners, grants.
- Create `order_ingredient_usage` with FKs, index, RLS enabled with no client policies, revoke all from anon/authenticated.
- Create `consume_order_ingredients`: skip missing inventory; reject unit mismatch; reject insufficient stock; lock inventory with `for update`; deduct `quantity_per_portion * oi.quantity`; insert usage.
- Create `restore_order_ingredients`: add back only rows with `restored_at is null`, set `restored_at`.
- Create trigger on `orders` `after update of status` when `new.status = 'cancelled'` and `old.status is distinct from 'cancelled'`.
- Recreate `portal_create_order` with the existing body plus `perform public.consume_order_ingredients(new_id);` after the total update and table status update, before the return query.
- Revoke public/anon/authenticated execute on helper functions; they are called internally only.

- [ ] **Step 4: Apply the migration to the linked project**

Run: `npx supabase db push --linked`
Expected: migration `202610260003` listed as applied.

- [ ] **Step 5: Run the SQL test to verify it passes**

Run: `npx supabase db query --linked --file supabase/tests/stock_recipe_test.sql`
Expected: no assertion error; all fixture changes rolled back.

---

### Task 2: Pure recipe validation helpers

**Files:**
- Create: `src/lib/recipes.ts`
- Create: `src/lib/__tests__/recipes.test.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces:
  - `MenuIngredient { name: string; quantity: number; unit: string }`
  - `RecipeDraft { name: string; quantity: string; unit: string }`
  - `validateRecipeRows(rows: RecipeDraft[]): string | null`
  - `toRecipeIngredients(rows: RecipeDraft[]): MenuIngredient[]`

- [ ] **Step 1: Write failing tests**

Test:
- valid rows trim names/units and parse quantity;
- blank rows are ignored;
- missing name, quantity `<= 0`, non-numeric quantity, and missing unit return an Indonesian error;
- duplicate names differing by case return an error;
- empty list is valid.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/lib/__tests__/recipes.test.ts`
Expected: FAIL because `src/lib/recipes.ts` cannot be imported.

- [ ] **Step 3: Implement helpers and type**

`validateRecipeRows` returns the first error string or `null`; `toRecipeIngredients` returns cleaned rows with numeric quantity. Add `MenuIngredient` to `src/types/index.ts` and change `MasterMenuItem.ingredients?: MenuIngredient[]`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/lib/__tests__/recipes.test.ts`
Expected: PASS.

---

### Task 3: App data layer

**Files:**
- Modify: `src/context/AppContext.tsx`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `MenuIngredient`, `RecipeDraft` helpers, Supabase tables from Task 1.
- Produces:
  - `InventoryInput { name: string; category: string; unit: string; currentStock: number; minThreshold: number; costPerUnit: number }`
  - `addInventoryItem(input: InventoryInput): Promise<OpResult>`
  - menu fetch includes `menu_ingredients(name, quantity, unit)` and `allergens`
  - `addMasterMenu`/`updateMasterMenu` persist recipe rows; `menuToDb` persists allergens.

- [ ] **Step 1: Update DB types and mapping**

Add `DbMenuItem.allergens`, nested `menu_ingredients`; map to `MasterMenuItem.ingredients` sorted by name and `allergens`. Change menu fetch select to `'*, menu_ingredients(name, quantity, unit)'`.

- [ ] **Step 2: Persist recipes and allergens**

`menuToDb` maps `allergens`. `addMasterMenu` inserts `menu_ingredients` after the menu; on recipe failure deletes the new menu. `updateMasterMenu` replaces recipes when `updates.ingredients` is present (delete then insert; return failure on error). `menuToDb` does not send `ingredients` as a column.

- [ ] **Step 3: Add inventory creation**

Implement `addInventoryItem` with trimmed name/unit, non-negative numeric validation, duplicate name check per branch, insert with current `restaurantId` and `currentUser.branchId`, `last_restocked_at` when initial stock > 0, audit log `TAMBAH_STOK`, toast, and `fetchAllData`. Add to `AppContextType` and provider value.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 4: Master Catalog recipe editor

**Files:**
- Modify: `src/views/super-admin/MasterKatalogMenu.tsx`

**Interfaces:**
- Consumes: `MenuIngredient`, `RecipeDraft`, `validateRecipeRows`, `toRecipeIngredients`, AppContext menu methods.
- Produces: recipe editor UI and `ingredients` payload.

- [ ] **Step 1: Update form state and mapping**

`FormState.ingredients` becomes `RecipeDraft[]`; `EMPTY` uses `[]`; `openEdit` maps saved ingredients to strings; `validate` uses `validateRecipeRows`; `submit` sends `toRecipeIngredients`. Keep `allergens` as comma text and send `parseList`.

- [ ] **Step 2: Build the editor**

Replace the old comma-separated ingredients input with a fieldset of rows: name input, quantity number (`step="0.001"`, min > 0), unit input, remove button; add row button. Show error/hint. Add the recipe count to menu cards so missing recipes are visible.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS; Three.js remains a separate lazy chunk.

---

### Task 5: Stock page add form and empty state

**Files:**
- Modify: `src/views/branch-admin/StokBahanBaku.tsx`

**Interfaces:**
- Consumes: `addInventoryItem`, `masterMenus` recipe ingredients, existing `adjustStock`.
- Produces: "Tambah Bahan" modal, empty state, ingredient suggestions, corrected status badges.

- [ ] **Step 1: Add form state and suggestions**

Add `addOpen`, `addForm`, `addError`, `addSaving`; derive unique `{name, unit}` suggestions from `masterMenus.flatMap(m => m.ingredients ?? [])`; auto-fill unit when a suggested name is chosen.

- [ ] **Step 2: Build modal and empty state**

Header button "Tambah Bahan"; empty state when `branchInv.length === 0`; modal fields name (datalist), category, unit, current stock, min threshold, cost per unit; validate non-negative numbers; call `addInventoryItem`; show inline error; close on success.

- [ ] **Step 3: Fix status badges**

Render one badge with `Habis` (out_of_stock), `Menipis` (low_stock), or `Tersedia Aman` (in_stock); remove duplicated status markup.

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

---

### Task 6: Verification and delivery

**Files:** no production changes unless verification finds a bug.

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: all files and tests pass.

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Re-run SQL regression test**

Run: `npx supabase db query --linked --file supabase/tests/stock_recipe_test.sql`
Expected: PASS; no residual fixture rows.

- [ ] **Step 4: PostgREST smoke test**

Use the app anon key to call `portal_create_order` for a temporary order with a recipe and verify stock/usage; clean up all temporary rows. Do not print secrets.

- [ ] **Step 5: Browser QA if a branch-admin session is available**

Open the stock page, add a bahan, verify empty state and modal; open Master Katalog, add recipe rows, save, reload, verify persistence; submit a portal order and verify stock; cancel and verify restore. If no staff credentials are available, report that limitation explicitly.
