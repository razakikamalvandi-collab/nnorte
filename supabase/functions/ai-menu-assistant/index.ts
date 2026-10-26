// Edge Function: ai-menu-assistant
//
// Membuat draf menu katalog master (nama, kategori, deskripsi, bahan per porsi,
// algen) dari ide teks pemilik menggunakan Google Gemini. Kunci API
// GEMINI_API_KEY hanya dibaca di sini (environment Edge Function / Supabase
// secrets) dan tidak pernah dikirim ke browser.
//
// Aksi (POST JSON):
//   { prompt: string, categories?: string[] }
//
// Hanya PEMILIK UTAMA (membership role = owner, status = active) yang boleh
// memanggil — katalog master dikelola owner. Hasil AI selalu disanitasi:
// batas panjang, maksimal 20 bahan, kategori dipaksa ke daftar milik klien.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const MAX_PROMPT = 500;
const MAX_INGREDIENTS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  // Autentikasi memakai bearer token (bukan cookie), jadi "*" tidak membuka celah CSRF.
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

const clamp = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

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

    // Katalog master hanya dikelola pemilik utama.
    const { data: ownerRows, error: ownerErr } = await userClient
      .from("memberships")
      .select("restaurant_id")
      .eq("user_id", userData.user.id)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1);
    if (ownerErr) throw new HttpError(500, "Gagal memeriksa hak akses.");
    if (!ownerRows || ownerRows.length === 0) {
      throw new HttpError(403, "Hanya pemilik utama yang dapat memakai asisten menu.");
    }

    if (!GEMINI_API_KEY) {
      throw new HttpError(500, 'Layanan AI belum dikonfigurasi. Jalankan "npx supabase secrets set GEMINI_API_KEY=..." di server.');
    }

    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      throw new HttpError(400, "Body permintaan bukan JSON yang valid.");
    }

    const prompt = clamp(payload.prompt, MAX_PROMPT);
    if (prompt.length < 3) throw new HttpError(400, "Tuliskan ide menu (minimal 3 karakter).");
    const categories = Array.isArray(payload.categories)
      ? payload.categories.filter((c): c is string => typeof c === "string" && !!c.trim()).slice(0, 50)
      : [];
    if (!UUID_RE.test(ownerRows[0].restaurant_id as string)) throw new HttpError(500, "Data restoran tidak valid.");

    const systemPrompt = [
      "Kamu asisten menu untuk restoran Indonesia. Buat SATU draf menu dari ide pengguna.",
      "Jawab HANYA JSON valid tanpa teks lain, dengan bentuk persis:",
      '{"name": string, "category": string, "description": string, "ingredients": [{"name": string, "quantity": number, "unit": string}], "allergens": string[]}',
      'Aturan: "name" bahasa Indonesia menarik, maksimal 60 karakter, tanpa tanda kutip.',
      '"category" HARUS salah satu dari daftar kategori berikut bila cocok, jika tidak cocok pakai "": ' + (categories.length ? JSON.stringify(categories) : '[]') + ".",
      '"description" bahasa Indonesia menggugah, maksimal 300 karakter.',
      '"ingredients" 1-20 bahan utama per 1 porsi dengan takaran realistis; "quantity" angka > 0;',
      'gunakan satuan umum: gram, kg, ml, l, pcs, butir, sdt, sdm. Nama bahan umum (mis. "Beras", "Ayam", "Saus Tomat").',
      '"allergens" berisi algen relevan dari daftar umum: Gluten, Telur, Susu, Kacang, Seafood, Kedelai, Ikan, Sabit; kosongkan bila tidak ada.',
      "Ide menu dari pengguna: " + JSON.stringify(prompt),
    ].join("\n");

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json", maxOutputTokens: 2048 },
        }),
      },
    );
    if (!geminiRes.ok) {
      console.error("Gemini error:", geminiRes.status, (await geminiRes.text()).slice(0, 500));
      throw new HttpError(502, "Layanan AI sedang bermasalah. Coba lagi sesaat lagi.");
    }

    const geminiData = await geminiRes.json();
    const text: unknown = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(typeof text === "string" ? text : "null");
    } catch {
      throw new HttpError(502, "AI memberikan jawaban yang tidak valid. Coba lagi.");
    }
    if (!raw || typeof raw !== "object") throw new HttpError(502, "AI memberikan jawaban yang tidak valid. Coba lagi.");

    // Sanitasi: kategori dipaksa ke daftar klien; bahan dibatasi; angka dijaga positif.
    const name = clamp(raw.name, 100);
    if (!name) throw new HttpError(502, "AI tidak menghasilkan nama menu. Coba ide lain.");
    const wantedCategory = clamp(raw.category, 60).toLowerCase();
    const category = categories.find((c) => c.toLowerCase() === wantedCategory) ?? "";
    const description = clamp(raw.description, 500);
    const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients.slice(0, MAX_INGREDIENTS) : [];
    const ingredients = rawIngredients
      .map((row) => {
        const r = (row ?? {}) as Record<string, unknown>;
        const qty = typeof r.quantity === "number" && Number.isFinite(r.quantity) && r.quantity > 0 ? r.quantity : 1;
        return { name: clamp(r.name, 100), quantity: String(qty), unit: clamp(r.unit, 30) };
      })
      .filter((row) => row.name.length > 0);
    const rawAllergens = Array.isArray(raw.allergens) ? raw.allergens : [];
    const allergens = rawAllergens
      .map((a) => clamp(a, 40))
      .filter(Boolean)
      .join(", ");

    return json(req, 200, { ok: true, menu: { name, category, description, ingredients, allergens } });
  } catch (err) {
    if (err instanceof HttpError) return json(req, err.status, { ok: false, error: err.message });
    console.error("ai-menu-assistant error:", err);
    return json(req, 500, { ok: false, error: "Terjadi kesalahan pada server." });
  }
});
