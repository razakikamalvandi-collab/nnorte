// Edge Function: admin-users
//
// Operasi akun yang butuh hak administrator Supabase Auth. Service-role key HANYA
// dibaca di sini (environment Edge Function) dan tidak pernah dikirim ke browser.
//
// Aksi (POST JSON):
//   { action: "create_user",    full_name, role, branch_id, password, phone? }
//   { action: "reset_password", user_id, new_password }
//   { action: "revoke_access",  user_id }
//   { action: "update_profile", user_id, full_name, phone }
//
// create_user & reset_password hanya untuk PEMILIK UTAMA (membership role = owner,
// status = active). revoke_access juga boleh dari ADMIN CABANG aktif, dengan cakupan
// sempit: hanya kasir/dapur di cabangnya sendiri. Tidak ada yang dapat menembak owner
// atau dirinya sendiri. Email korporat dibuat di server (RPC corporate_email_for)
// sehingga klien tidak bisa memilih alamat sembarang. Password tidak pernah ditulis
// ke log maupun audit.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const ASSIGNABLE_ROLES = ["branch_admin", "cashier", "kitchen"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^(?:\+62|62|0)[1-9][0-9]{7,12}$/;
const normalizePhone = (value: string) => value.replace(/[\s().-]/g, "");

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  // Autentikasi memakai bearer token (bukan cookie), jadi "*" tidak membuka celah CSRF.
  // Isi ALLOWED_ORIGINS (dipisah koma) untuk membatasi ke domain produksi.
  const allow = ALLOWED_ORIGINS.length === 0 ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function validatePassword(pw: unknown): string {
  if (typeof pw !== "string" || pw.length < 8) throw new HttpError(400, "Kata sandi minimal 8 karakter.");
  if (pw.length > 72) throw new HttpError(400, "Kata sandi maksimal 72 karakter.");
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new HttpError(400, "Kata sandi harus berisi huruf dan angka.");
  return pw;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { ok: false, error: "Metode tidak diizinkan." });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new HttpError(401, "Sesi tidak ditemukan. Silakan login ulang.");

    // Klien atas nama pemanggil (RLS berlaku).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new HttpError(401, "Sesi tidak valid. Silakan login ulang.");
    const caller = userData.user;

    // Pemanggil wajib owner aktif (semua aksi) atau admin cabang aktif (revoke_access).
    const { data: callerRows, error: callerErr } = await userClient
      .from("memberships")
      .select("restaurant_id, role, branch_id")
      .eq("user_id", caller.id)
      .eq("status", "active");
    if (callerErr) throw new HttpError(500, "Gagal memeriksa hak akses.");
    const ownerRow = callerRows?.find((m) => m.role === "owner");
    const staffAdminRow = callerRows?.find((m) => m.role === "branch_admin");
    const restaurantId = (ownerRow?.restaurant_id ?? staffAdminRow?.restaurant_id) as string | undefined;
    const callerRole: "owner" | "branch_admin" | undefined = ownerRow ? "owner" : staffAdminRow ? "branch_admin" : undefined;
    const callerBranchId = (staffAdminRow?.branch_id ?? null) as string | null;
    if (!restaurantId || !callerRole) throw new HttpError(403, "Anda tidak memiliki izin untuk melakukan aksi ini.");

    // Klien administrator (service role) - hanya untuk operasi di bawah.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      throw new HttpError(400, "Body permintaan bukan JSON yang valid.");
    }

    const audit = async (branchId: string | null, action: string, target: string, outcome: "success" | "warning" | "error" = "success") => {
      const { error } = await admin.from("audit_logs").insert({
        restaurant_id: restaurantId,
        branch_id: branchId,
        actor_id: caller.id,
        action,
        target,
        outcome,
        metadata: {},
      });
      if (error) console.error("Gagal menulis audit log:", error.message);
    };

    // ------------------------------------------------------------- update_profile
    if (payload.action === "update_profile") {
      const userId = payload.user_id;
      const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
      const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
      if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new HttpError(400, "Pengguna tidak valid.");
      if (fullName.length < 2 || fullName.length > 80) throw new HttpError(400, "Nama lengkap harus 2-80 karakter.");
      if (!phone || phone.length > 30 || !PHONE_RE.test(normalizePhone(phone))) {
        throw new HttpError(400, "Nomor telepon Indonesia tidak valid.");
      }

      const { data: memberships, error: targetErr } = await admin
        .from("memberships")
        .select("restaurant_id, role, branch_id, status")
        .eq("user_id", userId);
      if (targetErr) throw new HttpError(500, "Gagal memeriksa data pengguna.");
      const targetRows = memberships ?? [];
      if (targetRows.length === 0 || targetRows.some((m) => m.restaurant_id !== restaurantId)) {
        throw new HttpError(403, "Pengguna bukan anggota cabang yang dapat dikelola.");
      }
      if (targetRows.some((m) => m.role === "owner")) throw new HttpError(403, "Profil pemilik utama tidak dapat diubah dari menu ini.");
      if (callerRole === "branch_admin" && targetRows.some((m) =>
        m.status !== "active" || m.role !== "cashier" && m.role !== "kitchen" || m.branch_id !== callerBranchId
      )) {
        throw new HttpError(403, "Admin cabang hanya dapat mengubah profil kasir/dapur aktif di cabangnya sendiri.");
      }

      const { error: profileErr } = await admin.from("profiles").update({ full_name: fullName, phone }).eq("id", userId);
      if (profileErr) throw new HttpError(500, "Gagal memperbarui profil karyawan.");
      const targetBranch = targetRows.find((m) => m.branch_id)?.branch_id as string | null | undefined;
      await audit(targetBranch ?? null, "UBAH_PROFIL_KARYAWAN", `${userId}: ${fullName}`);
      return json(req, 200, { ok: true });
    }

    // ------------------------------------------------------------------ create_user
    if (payload.action === "create_user") {
      if (callerRole !== "owner") throw new HttpError(403, "Hanya pemilik utama yang dapat mengelola akun pengguna.");
      const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
      const role = payload.role as AssignableRole;
      const branchId = payload.branch_id;
      const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
      const password = validatePassword(payload.password);

      if (fullName.length < 2 || fullName.length > 80) throw new HttpError(400, "Nama lengkap harus 2-80 karakter.");
      if (!phone) throw new HttpError(400, "Nomor telepon wajib diisi.");
      if (phone.length > 30 || !PHONE_RE.test(normalizePhone(phone))) {
        throw new HttpError(400, "Nomor telepon Indonesia tidak valid.");
      }
      if (!ASSIGNABLE_ROLES.includes(role)) throw new HttpError(400, "Role tidak valid. Role pemilik utama tidak dapat diberikan.");
      if (typeof branchId !== "string" || !UUID_RE.test(branchId)) throw new HttpError(400, "Cabang wajib dipilih.");

      const { data: branch, error: branchErr } = await admin
        .from("branches")
        .select("id")
        .eq("id", branchId)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (branchErr || !branch) throw new HttpError(400, "Cabang tidak valid untuk restoran ini.");

      let createdId: string | null = null;
      let email = "";
      // Dua pembuatan bersamaan bisa menghasilkan email yang sama; ulangi dengan pratinjau baru.
      for (let attempt = 0; attempt < 3 && !createdId; attempt++) {
        const { data: previewEmail, error: previewErr } = await userClient.rpc("preview_corporate_email", {
          p_role: role,
          p_branch: branchId,
        });
        if (previewErr || typeof previewEmail !== "string") throw new HttpError(400, "Gagal membuat email korporat.");
        email = previewEmail;

        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createErr) {
          const msg = createErr.message.toLowerCase();
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) continue;
          throw new HttpError(400, "Gagal membuat akun: " + createErr.message);
        }
        createdId = created.user.id;
      }
      if (!createdId) throw new HttpError(409, "Email korporat bentrok. Coba lagi.");

      // Profil dibuat trigger on_auth_user_created; lengkapi telepon lalu buat membership.
      const rollback = async () => {
        await admin.auth.admin.deleteUser(createdId!);
      };
      if (phone) {
        const { error: profErr } = await admin.from("profiles").update({ phone }).eq("id", createdId);
        if (profErr) {
          await rollback();
          throw new HttpError(500, "Gagal menyimpan profil. Akun dibatalkan.");
        }
      }
      const { error: memErr } = await admin.from("memberships").insert({
        restaurant_id: restaurantId,
        user_id: createdId,
        branch_id: branchId,
        role,
        status: "active",
      });
      if (memErr) {
        await rollback();
        throw new HttpError(500, "Gagal menetapkan hak akses. Akun dibatalkan.");
      }

      await audit(branchId, "TAMBAH_PENGGUNA", `${email} (${role})`);
      return json(req, 200, { ok: true, user: { id: createdId, email, role, branch_id: branchId } });
    }

    // -------------------------------------------------------------- reset_password
    if (payload.action === "reset_password") {
      if (callerRole !== "owner") throw new HttpError(403, "Hanya pemilik utama yang dapat mengelola akun pengguna.");
      const userId = payload.user_id;
      const newPassword = validatePassword(payload.new_password);
      if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new HttpError(400, "Pengguna tidak valid.");
      if (userId === caller.id) {
        throw new HttpError(400, "Untuk mengubah kata sandi Anda sendiri gunakan menu Ubah Kata Sandi.");
      }

      const { data: membership } = await admin
        .from("memberships")
        .select("branch_id, role")
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId)
        .neq("role", "owner")
        .limit(1)
        .maybeSingle();
      if (!membership) throw new HttpError(403, "Pengguna bukan anggota yang dapat dikelola oleh pemilik ini.");

      const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
      if (updErr) throw new HttpError(400, "Gagal mengubah kata sandi: " + updErr.message);

      await audit(membership.branch_id as string | null, "RESET_PASSWORD", `Kata sandi pengguna ${userId} direset oleh pemilik`);
      return json(req, 200, { ok: true });
    }

    // ----------------------------------------------------------------- revoke_access
    // "Hapus" staf: membership dihapus + email korporat ditukar ke placeholder internal.
    // Akun Auth & profil TIDAK dihapus (riwayat audit/pengeluaran tetap tertaut), tetapi
    // orang itu tidak bisa login lagi dengan email korporat lama (emailnya ditukar diam-
    // diam) dan email lama langsung bebas dipakai staf baru.
    if (payload.action === "revoke_access") {
      const userId = payload.user_id;
      if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new HttpError(400, "Pengguna tidak valid.");
      if (userId === caller.id) throw new HttpError(400, "Tidak dapat mencabut akses akun Anda sendiri.");

      // Snapshot semua membership target di seluruh restoran (service role).
      // Diurutkan agar audit deterministik bila target punya lebih dari satu baris.
      const { data: targetRows, error: targetErr } = await admin
        .from("memberships")
        .select("restaurant_id, role, branch_id")
        .eq("user_id", userId)
        .order("branch_id", { ascending: true, nullsFirst: false })
        .order("role", { ascending: true });
      if (targetErr) throw new HttpError(500, "Gagal memeriksa data pengguna.");
      if (!targetRows || targetRows.length === 0) {
        throw new HttpError(404, "Pengguna bukan staf di restoran mana pun.");
      }

      if (targetRows.some((m) => m.role === "owner")) {
        throw new HttpError(403, "Akun pemilik utama tidak dapat dicabut aksesnya.");
      }
      if (targetRows.some((m) => m.restaurant_id !== restaurantId)) {
        throw new HttpError(403, "Pengguna juga terdaftar di restoran lain. Hubungi pemilik restoran tersebut.");
      }
      if (callerRole === "branch_admin") {
        const inScope = targetRows.every(
          (m) => (m.role === "cashier" || m.role === "kitchen") && m.branch_id === callerBranchId,
        );
        if (!inScope) {
          throw new HttpError(403, "Admin cabang hanya dapat mencabut akses kasir/dapur di cabangnya sendiri.");
        }
      }

      const { data: targetAuth, error: authErr } = await admin.auth.admin.getUserById(userId);
      if (authErr || !targetAuth?.user) throw new HttpError(404, "Akun pengguna tidak ditemukan.");
      const oldEmail = targetAuth.user.email ?? "(tanpa email)";
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
      const fullName = typeof profile?.full_name === "string" && profile.full_name ? profile.full_name : oldEmail;
      const roleList = Array.from(new Set(targetRows.map((m) => String(m.role)))).join("/");
      const branchTarget = targetRows[0]?.branch_id ?? null;

      // Urutan disengaja: tukar email DULU (bila gagal, tidak ada yang berubah dan
      // tindakan bisa diulang dengan bersih), baru hapus membership. Bila hapus gagal
      // setelah email tertukar, coba pulihkan email lama; bila pemulihan juga gagal,
      // audit dicatat sebagai 'error' — membership masih ada sehingga tindakan tetap
      // bisa diulang.
      const placeholderEmail =
        "nonaktif." + crypto.randomUUID().replaceAll("-", "") + "@nnorte-removed.local";
      const { error: emailErr } = await admin.auth.admin.updateUserById(userId, {
        email: placeholderEmail,
        email_confirm: true,
      });
      if (emailErr) throw new HttpError(500, "Gagal menukar email akun: " + emailErr.message);

      const { error: delErr } = await admin
        .from("memberships")
        .delete()
        .eq("user_id", userId)
        .eq("restaurant_id", restaurantId);
      if (delErr) {
        await audit(branchTarget, "CABUT_AKUN", `${fullName} ${oldEmail} (${roleList})`, "error");
        const { error: restoreErr } = await admin.auth.admin.updateUserById(userId, {
          email: oldEmail,
          email_confirm: true,
        });
        if (restoreErr) {
          throw new HttpError(500, "Gagal menghapus hak akses dan email akun sementaranya tertukar. Coba pilih staf ini sekali lagi.");
        }
        throw new HttpError(500, "Gagal menghapus hak akses: " + delErr.message);
      }

      await audit(branchTarget, "CABUT_AKUN", `${fullName} ${oldEmail} (${roleList})`);
      return json(req, 200, { ok: true });
    }

    throw new HttpError(400, "Aksi tidak dikenal.");
  } catch (err) {
    if (err instanceof HttpError) return json(req, err.status, { ok: false, error: err.message });
    console.error("admin-users error:", err);
    return json(req, 500, { ok: false, error: "Terjadi kesalahan pada server." });
  }
});
