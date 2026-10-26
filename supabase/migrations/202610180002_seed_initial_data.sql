-- Seed data lengkap untuk multi-branch restaurant app.
-- Jalankan setelah migrasi skema awal (202610180001_initial_schema.sql).
-- Ganti 'UUID_PEMILIK' dengan UUID auth user owner (Supabase Auth > Users).
-- Data di bawah sinkron dengan src/data/mockData.ts agar frontend demo
-- dan database produksi memiliki isian yang sama.

begin;

-- ============================================================================
-- 1. Restoran (tenant)
-- ============================================================================

with ins_restoran as (
  insert into public.restaurants (name, slug, tagline, contact_email, contact_phone, currency, tax_percentage, service_charge_percentage, allow_online_takeaway, sound_alerts_enabled)
  values ('NNORTE Cafe', 'nnorte', 'Artisan Coffee & Wood-Fired Favorites', 'contact@nnorte.com', '+62 21 5289 1900', 'IDR', 10, 5, true, true)
  returning id
),

-- ============================================================================
-- 2. Cabang
-- ============================================================================
ins_cabang as (
  insert into public.branches (restaurant_id, code, name, tagline, address, city, phone, email, operating_hours, status, total_tables, manager_name)
  select id, 'NN-JKT01', 'NNORTE Senopati - Flagship Cafe', 'Artisan Coffee & Wood-Fired Favorites',
         'Jl. Senopati No. 42, Kebayoran Baru, Jakarta Selatan', 'Jakarta Selatan', '+62 21 5289 1900', 'senopati@nnorte.com',
         '11:00 - 23:00 WIB', 'active', 24, 'Reza Aditya'
  from ins_restoran
  returning id as branch_id, id, code, name
),
ins_cabang2 as (
  insert into public.branches (restaurant_id, code, name, tagline, address, city, phone, email, operating_hours, status, total_tables, manager_name)
  select id, 'NN-JKT02', 'NNORTE Sudirman - Central Lounge', 'Executive Prime Cuts & Wine Bar',
         'Sudirman Central Business District (SCBD) Lot 8, Jakarta Pusat', 'Jakarta Pusat', '+62 21 5790 3341', 'sudirman@nnorte.com',
         '10:00 - 23:30 WIB', 'active', 18, 'Maya Anggraini'
  from ins_restoran
  returning id as branch_id, id, code, name
),
ins_cabang3 as (
  insert into public.branches (restaurant_id, code, name, tagline, address, city, phone, email, operating_hours, status, total_tables, manager_name)
  select id, 'NN-JKT03', 'NNORTE Dharmawangsa - Wood-Fired', 'Artisan Smokehouse & Private Dining',
         'Jl. Dharmawangsa Raya No. 12, Kebayoran Baru, Jakarta Selatan', 'Jakarta Selatan', '+62 21 7278 8812', 'dharmawangsa@nnorte.com',
         '12:00 - 22:30 WIB', 'active', 16, 'Kresna Wardhana'
  from ins_restoran
  returning id as branch_id, id, code, name
),

-- ============================================================================
-- 3. Owner membership (ganti UUID_PEMILIK dengan UUID auth user asli)
-- ============================================================================
ins_owner as (
  insert into public.memberships (restaurant_id, user_id, role, status)
  select id, 'cfe745f1-4902-4a06-a758-a3fd4cc6c6f8'::uuid, 'owner', 'active'
  from public.restaurants where slug = 'nnorte'
  returning restaurant_id
),

-- ============================================================================
-- 5. Master menu items (katalog pusat)
-- ============================================================================
ins_menu as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-STK-01', 'Wagyu Tomahawk MB9+ (1.2 Kg)', 'Steaks',
         'Dry-aged 45 days, wood-fired over rambutan and coffee wood. Served with bone marrow butter and roasted garlic.',
         1450000, 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 30,
         '[{"name":"Tingkat Kematangan","options":["Rare","Medium Rare (Recommended)","Medium","Medium Well"]}]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu2 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-STK-02', 'Black Angus Prime Ribeye (300g)', 'Steaks',
         'USDA Prime Certified grain-fed Angus ribeye, seasoned with smoked sea salt and seared on cast iron over flaming oak embers.',
         485000, 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 20,
         '[{"name":"Tingkat Kematangan","options":["Rare","Medium Rare","Medium","Medium Well","Well Done"]}]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu3 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-STK-03', 'Smoked Short Ribs 12-Hour BBQ', 'Burgers & Ribs',
         'Slow-smoked beef ribs glazed with signature NNORTE spicy espresso BBQ reduction. Tender, fall-off-the-bone texture.',
         385000, 'https://images.unsplash.com/photo-1558030006-450675393462?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 15,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu4 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-BGR-01', 'NNORTE Signature Truffle Wagyu Burger', 'Burgers & Ribs',
         'Double smashed Wagyu patty, melted aged gruyere cheese, caramelized balsamic shallots, black summer truffle aioli on toasted brioche.',
         195000, 'https://images.unsplash.com/photo-1583953623787-ada99d338235?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 15,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu5 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-APP-01', 'Crispy Bone Marrow & Sourdough Crostini', 'Appetizers',
         'Roasted beef marrow topped with parsley shallot salad, pickled capers, and toasted rustic sourdough bread.',
         145000, 'https://images.unsplash.com/photo-1601356616077-695728ae17cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', false, false, 12,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu6 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-APP-02', 'Wood-Fired King Prawns Skewers', 'Appetizers',
         'Giant tiger prawns marinated in smoked paprika, garlic butter, and fresh lime, roasted over wood fire on bamboo skewers.',
         165000, 'https://images.unsplash.com/photo-1568376794508-ae52c6ab3929?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', false, false, 12,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu7 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-BEV-01', 'NNORTE Smoked Crimson Mocktail', 'Beverages',
         'Fresh pomegranate, wild hibiscus syrup, muddled rosemary, and elderflower tonic, served with smoky aromatic cloche.',
         65000, 'https://images.unsplash.com/photo-1609951651556-5334e2706168?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 5,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu8 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-BEV-02', 'Barrel-Aged Cold Brew Coffee', 'Beverages',
         'Single-origin Aceh Gayo beans steeped for 24 hours in charred oak barrels, served with orange peel twist.',
         55000, 'https://images.unsplash.com/photo-1500217052183-bc01eee1a74e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', false, false, 3,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu9 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-DES-01', 'Valrhona Dark Chocolate Molten Lava', 'Desserts',
         '70% Guanaja chocolate cake with molten heart, served with house-churned Tahitian vanilla bean gelato and berry compote.',
         95000, 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', true, false, 12,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),
ins_menu10 as (
  insert into public.menu_items (restaurant_id, sku, name, category, description, base_price, image_url, status, is_popular, is_spicy, preparation_time_minutes, variants)
  select r.id, 'NN-DES-02', 'Smoked Sea Salt Basque Cheesecake', 'Desserts',
         'Caramelized crust with velvety rich cream cheese center, dusted with Balinese artisan smoked pyramid salt.',
         85000, 'https://images.unsplash.com/photo-1585658930672-bbee7a596e2a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800',
         'active', false, false, 5,
         '[]'::jsonb
  from public.restaurants r where r.slug = 'nnorte'
  returning id as menu_id, id, sku
),

-- ============================================================================
-- 6. Branch menu items (harga & ketersediaan per cabang)
-- ============================================================================
-- Senopati (NN-JKT01)
ins_branch_menu_senopati as (
  insert into public.branch_menu_items (restaurant_id, branch_id, menu_item_id, price, is_available, is_sold_out_today, addons)
  select r.id, b.id, mi.id, m.price, true, false,
         case mi.sku
           when 'NN-STK-01' then '[{"id":"add-1","name":"Black Truffle Sauce","price":45000},{"id":"add-2","name":"Wild Forest Chimichurri","price":35000},{"id":"add-3","name":"Extra Bone Marrow","price":65000}]'::jsonb
           when 'NN-STK-02' then '[{"id":"add-4","name":"Green Peppercorn Jus","price":35000},{"id":"add-5","name":"Charred Broccolini","price":40000}]'::jsonb
           when 'NN-STK-03' then '[{"id":"add-6","name":"Creamed Truffle Spinach","price":45000},{"id":"add-7","name":"Sweet Potato Fries","price":35000}]'::jsonb
           when 'NN-BGR-01' then '[{"id":"add-8","name":"Crispy Beef Bacon Strip","price":25000},{"id":"add-9","name":"Sunny Side Wagyu Egg","price":20000}]'::jsonb
           else '[]'::jsonb
         end
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT01'
  join public.menu_items mi on mi.restaurant_id = r.id
  join (values
    ('NN-STK-01', 1450000),
    ('NN-STK-02', 485000),
    ('NN-STK-03', 385000),
    ('NN-BGR-01', 195000),
    ('NN-APP-01', 145000),
    ('NN-APP-02', 165000),
    ('NN-BEV-01', 65000),
    ('NN-BEV-02', 55000),
    ('NN-DES-01', 95000),
    ('NN-DES-02', 85000)
  ) as m(sku, price) on mi.sku = m.sku
  where r.slug = 'nnorte'
),
-- Sudirman (NN-JKT02)
ins_branch_menu_sudirman as (
  insert into public.branch_menu_items (restaurant_id, branch_id, menu_item_id, price, is_available, is_sold_out_today, addons)
  select r.id, b.id, mi.id, m.price, true, false, '[]'::jsonb
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT02'
  join public.menu_items mi on mi.restaurant_id = r.id
  join (values
    ('NN-STK-01', 1490000),
    ('NN-STK-02', 495000),
    ('NN-STK-03', 395000),
    ('NN-BGR-01', 205000),
    ('NN-APP-01', 155000),
    ('NN-APP-02', 175000),
    ('NN-BEV-01', 70000),
    ('NN-BEV-02', 60000),
    ('NN-DES-01', 98000),
    ('NN-DES-02', 88000)
  ) as m(sku, price) on mi.sku = m.sku
  where r.slug = 'nnorte'
),
-- Dharmawangsa (NN-JKT03)
ins_branch_menu_dharmawangsa as (
  insert into public.branch_menu_items (restaurant_id, branch_id, menu_item_id, price, is_available, is_sold_out_today, addons)
  select r.id, b.id, mi.id, m.price, true, false, '[]'::jsonb
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT03'
  join public.menu_items mi on mi.restaurant_id = r.id
  join (values
    ('NN-STK-01', 1450000),
    ('NN-STK-02', 485000),
    ('NN-STK-03', 385000),
    ('NN-BGR-01', 195000),
    ('NN-APP-01', 145000),
    ('NN-APP-02', 165000),
    ('NN-BEV-01', 65000),
    ('NN-BEV-02', 55000),
    ('NN-DES-01', 95000),
    ('NN-DES-02', 85000)
  ) as m(sku, price) on mi.sku = m.sku
  where r.slug = 'nnorte'
),

-- ============================================================================
-- 7. Dining tables (meja & QR)
-- ============================================================================
ins_tables_senopati as (
  insert into public.dining_tables (restaurant_id, branch_id, table_number, capacity, status, qr_code_token)
  select r.id, b.id, t.table_number, t.capacity, t.status, 'QR-SEN-' || right(t.table_number, 2)
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT01'
  join (values
    ('Meja 01', 2, 'occupied'),
    ('Meja 02', 4, 'occupied'),
    ('Meja 03', 4, 'available'),
    ('Meja 04', 6, 'billing'),
    ('VIP 01', 10, 'reserved'),
    ('Meja 05', 4, 'available'),
    ('Meja 06', 2, 'available')
  ) as t(table_number, capacity, status) on true
  where r.slug = 'nnorte'
),
ins_tables_sudirman as (
  insert into public.dining_tables (restaurant_id, branch_id, table_number, capacity, status, qr_code_token)
  select r.id, b.id, t.table_number, t.capacity, t.status, 'QR-SUD-' || right(t.table_number, 2)
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT02'
  join (values
    ('Meja S-01', 4, 'occupied'),
    ('Meja S-02', 4, 'available'),
    ('Executive Lounge A', 8, 'available')
  ) as t(table_number, capacity, status) on true
  where r.slug = 'nnorte'
),
ins_tables_dharmawangsa as (
  insert into public.dining_tables (restaurant_id, branch_id, table_number, capacity, status, qr_code_token)
  select r.id, b.id, t.table_number, t.capacity, t.status, 'QR-DHA-' || t.token_suffix
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT03'
  join (values
    ('Meja D-01', 2, 'available', '01'),
    ('Meja D-02', 4, 'occupied', '02'),
    ('Meja D-03', 4, 'available', '03'),
    ('Private Room 1', 8, 'reserved', 'VIP1')
  ) as t(table_number, capacity, status, token_suffix) on true
  where r.slug = 'nnorte'
),

-- ============================================================================
-- 8. Inventory items (stok bahan baku per cabang)
-- ============================================================================
ins_inventory_senopati as (
  insert into public.inventory_items (restaurant_id, branch_id, name, category, current_stock, unit, min_threshold, cost_per_unit, last_restocked_at)
  select r.id, b.id, i.name, i.category, i.current_stock, i.unit, i.min_threshold, i.cost_per_unit, i.last_restocked_at::timestamptz
  from public.restaurants r
  join public.branches b on b.restaurant_id = r.id and b.code = 'NN-JKT01'
  join (values
    ('Wagyu Tomahawk MB9+ Cut', 'Meat & Poultry', 14, 'Pieces (1.2kg)', 8, 650000, '2026-04-15'),
    ('Black Angus Prime Ribeye', 'Meat & Poultry', 5, 'Kilograms', 10, 240000, '2026-06-14'),
    ('Black Summer Truffle Paste', 'Condiments', 2, 'Jars (500g)', 3, 420000, '2026-08-10'),
    ('Artisan Brioche Burger Buns', 'Bakery', 48, 'Pieces', 20, 12000, '2026-09-16'),
    ('Rambutan & Coffee Wood Logs', 'Fuel & Smoke', 250, 'Kilograms', 100, 18000, '2026-10-12')
  ) as i(name, category, current_stock, unit, min_threshold, cost_per_unit, last_restocked_at) on true
  where r.slug = 'nnorte'
)

select 'Seed data selesai dimasukkan. Silakan pastikan UUID owner sudah benar di bagian ins_owner.' as info;

commit;
