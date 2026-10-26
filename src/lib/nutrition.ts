
/**
 * Mesin nutrisi dan Asisten Menu NNORTE.
 * Berjalan di browser tanpa API key.
 *
 * Semua resep dan nilai gizi merupakan estimasi awal.
 * Periksa resep, takaran, merek bahan, dan ukuran porsi
 * sebelum menyimpan menu ke katalog.
 */

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
}

export interface NutritionResult extends NutritionFacts {
  totalWeight: number;
  unknown: string[];
  skipped: string[];
}

export interface IngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

type Per100 = NutritionFacts;

const n = (
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  sugar: number,
  fiber: number,
  sodium: number,
): Per100 => ({
  calories,
  protein,
  carbs,
  fat,
  sugar,
  fiber,
  sodium,
});

interface DbEntry {
  keys: string[];
  per100: Per100;
  allergens?: string[];
}

/**
 * Nilai perkiraan per 100 gram atau 100 ml.
 * Nilai produk kemasan dapat berbeda sesuai merek.
 */
export const INGREDIENT_DB: DbEntry[] = [
  // PROTEIN HEWANI
  {
    keys: ["dada ayam", "ayam panggang", "ayam goreng", "ayam geprek", "ayam"],
    per100: n(165, 31, 0, 3.6, 0, 0, 74),
  },
  {
    keys: ["daging sapi", "beef steak", "beef patty", "beef", "sapi"],
    per100: n(250, 26, 0, 15, 0, 0, 60),
  },
  {
    keys: ["daging kambing", "kambing"],
    per100: n(143, 27, 0, 3, 0, 0, 86),
  },
  {
    keys: ["daging bebek", "bebek"],
    per100: n(200, 19, 0, 13, 0, 0, 80),
  },
  {
    keys: ["salmon"],
    per100: n(208, 20, 0, 13, 0, 0, 59),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan tuna", "tuna"],
    per100: n(130, 28, 0, 1, 0, 0, 40),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan tongkol", "tongkol"],
    per100: n(130, 26, 0, 2, 0, 0, 50),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan kembung", "kembung"],
    per100: n(167, 20, 0, 10, 0, 0, 90),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan nila", "nila"],
    per100: n(128, 26, 0, 3, 0, 0, 56),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan lele", "lele"],
    per100: n(105, 18, 0, 3, 0, 0, 50),
    allergens: ["Ikan"],
  },
  {
    keys: ["ikan kakap", "kakap"],
    per100: n(128, 26, 0, 2.5, 0, 0, 60),
    allergens: ["Ikan"],
  },
  {
    keys: ["udang"],
    per100: n(99, 24, 0.2, 0.3, 0, 0, 111),
    allergens: ["Krustasea"],
  },
  {
    keys: ["cumi-cumi", "cumi"],
    per100: n(92, 16, 3.1, 1.4, 0, 0, 44),
    allergens: ["Moluska"],
  },
  {
    keys: ["kerang"],
    per100: n(148, 25, 5, 2, 0, 0, 500),
    allergens: ["Moluska"],
  },
  {
    keys: ["telur ayam", "telur"],
    per100: n(143, 13, 1, 10, 0.4, 0, 142),
    allergens: ["Telur"],
  },
  {
    keys: ["sosis"],
    per100: n(300, 12, 4, 26, 1, 0, 1100),
  },
  {
    keys: ["bakso sapi", "bakso"],
    per100: n(200, 14, 8, 12, 1, 0, 700),
  },
  {
    keys: ["kornet"],
    per100: n(250, 16, 5, 18, 1, 0, 900),
  },
  {
    keys: ["daging asap", "smoked beef"],
    per100: n(180, 25, 2, 8, 1, 0, 1000),
  },

  // TAHU, TEMPE, KACANG, DAN SUMBER PROTEIN NABATI
  {
    keys: ["tahu putih", "tahu sutra", "tahu"],
    per100: n(76, 8, 1.9, 4.8, 0.5, 0.3, 7),
    allergens: ["Kedelai"],
  },
  {
    keys: ["tempe"],
    per100: n(193, 20, 9, 11, 0, 1.4, 9),
    allergens: ["Kedelai"],
  },
  {
    keys: ["edamame", "kedelai"],
    per100: n(121, 12, 9, 5, 2.2, 5.2, 6),
    allergens: ["Kedelai"],
  },
  {
    keys: ["kacang tanah", "kacang"],
    per100: n(567, 26, 16, 49, 4, 8.5, 18),
    allergens: ["Kacang"],
  },
  {
    keys: ["selai kacang", "peanut butter"],
    per100: n(588, 25, 20, 50, 9, 6, 400),
    allergens: ["Kacang"],
  },
  {
    keys: ["wijen"],
    per100: n(573, 18, 23, 50, 0.3, 12, 11),
    allergens: ["Wijen"],
  },

  // NASI, MIE, ROTI, DAN KARBOHIDRAT
  {
    keys: ["nasi merah"],
    per100: n(111, 2.6, 23, 0.9, 0.4, 1.8, 5),
  },
  {
    keys: ["nasi putih", "nasi matang", "nasi"],
    per100: n(130, 2.7, 28, 0.3, 0.1, 0.4, 1),
  },
  {
    keys: ["ketan"],
    per100: n(169, 3.5, 37, 0.3, 0.1, 1, 5),
  },
  {
    keys: ["bihun"],
    per100: n(109, 0.9, 25, 0.2, 0.1, 1, 19),
  },
  {
    keys: ["kwetiau"],
    per100: n(110, 1.5, 25, 0.2, 0.1, 0.5, 5),
  },
  {
    keys: ["mie telur", "mie instan", "mie kuning", "mi", "mie"],
    per100: n(158, 5.8, 31, 0.9, 0.6, 1.8, 6),
    allergens: ["Gandum"],
  },
  {
    keys: ["spaghetti", "makaroni", "pasta"],
    per100: n(158, 5.8, 31, 0.9, 0.6, 1.8, 6),
    allergens: ["Gandum"],
  },
  {
    keys: ["tepung tapioka", "tepung kanji", "tapioka", "kanji"],
    per100: n(358, 0.2, 88, 0, 0, 0.9, 1),
  },
  {
    keys: ["tepung beras"],
    per100: n(366, 6, 80, 1.4, 0.1, 2.4, 0),
  },
  {
    keys: ["tepung maizena", "maizena", "tepung jagung"],
    per100: n(381, 0.3, 91, 0.1, 0, 0.9, 9),
  },
  {
    keys: ["tepung terigu", "tepung roti", "tepung"],
    per100: n(364, 10, 76, 1, 0.3, 2.7, 2),
    allergens: ["Gandum"],
  },
  {
    keys: ["roti burger", "roti tawar", "roti gandum", "roti"],
    per100: n(265, 9, 49, 3.2, 5, 2.7, 490),
    allergens: ["Gandum"],
  },
  {
    keys: ["kulit pangsit", "kulit dimsum", "kulit lumpia"],
    per100: n(290, 8, 55, 4, 2, 2, 500),
    allergens: ["Gandum"],
  },
  {
    keys: ["oatmeal", "rolled oats", "oat"],
    per100: n(389, 17, 66, 7, 1, 11, 2),
    allergens: ["Gandum"],
  },
  {
    keys: ["granola"],
    per100: n(471, 10, 64, 20, 20, 8, 200),
  },
  {
    keys: ["kentang"],
    per100: n(77, 2, 17, 0.1, 0.8, 2.2, 6),
  },
  {
    keys: ["ubi jalar", "ubi"],
    per100: n(86, 1.6, 20, 0.1, 4.2, 3, 55),
  },
  {
    keys: ["jagung"],
    per100: n(96, 3.4, 21, 1.5, 4.5, 2.4, 15),
  },

  // SAYURAN DAN BUMBU
  {
    keys: ["selada romaine", "selada"],
    per100: n(17, 1.2, 3.3, 0.3, 1.2, 2.1, 8),
  },
  {
    keys: ["brokoli"],
    per100: n(34, 2.8, 7, 0.4, 1.7, 2.6, 33),
  },
  {
    keys: ["wortel"],
    per100: n(41, 0.9, 10, 0.2, 4.7, 2.8, 69),
  },
  {
    keys: ["sayuran campur", "sayuran", "sayur"],
    per100: n(45, 2.1, 7.5, 1.2, 2.5, 3.2, 120),
  },
  {
    keys: ["bawang merah"],
    per100: n(40, 1.1, 9.3, 0.1, 4.2, 1.7, 4),
  },
  {
    keys: ["bawang putih"],
    per100: n(149, 6.4, 33.1, 0.5, 1, 2.1, 17),
  },
  {
    keys: ["bawang bombai", "bawang bombay"],
    per100: n(40, 1.1, 9.3, 0.1, 4.2, 1.7, 4),
  },
  {
    keys: ["cabai rawit", "cabai merah", "cabai hijau", "cabai", "cabe", "chili"],
    per100: n(40, 1.9, 9, 0.4, 5.3, 1.5, 9),
  },
  {
    keys: ["jahe"],
    per100: n(80, 1.8, 18, 0.8, 1.7, 2, 13),
  },
  {
    keys: ["serai", "sereh"],
    per100: n(99, 1.8, 25, 0.5, 0, 0, 6),
  },
  {
    keys: ["daun jeruk"],
    per100: n(40, 1, 8, 0.5, 0, 2, 5),
  },
  {
    keys: ["daun bawang"],
    per100: n(32, 1.8, 7.3, 0.2, 2.3, 2.6, 16),
  },
  {
    keys: ["seledri"],
    per100: n(16, 0.7, 3, 0.2, 1.3, 1.6, 80),
  },
  {
    keys: ["tomat"],
    per100: n(18, 0.9, 3.9, 0.2, 2.6, 1.2, 5),
  },
  {
    keys: ["timun", "mentimun"],
    per100: n(15, 0.7, 3.6, 0.1, 1.7, 0.5, 2),
  },
  {
    keys: ["kol", "kubis"],
    per100: n(25, 1.3, 5.8, 0.1, 3.2, 2.5, 18),
  },
  {
    keys: ["bayam"],
    per100: n(23, 2.9, 3.6, 0.4, 0.4, 2.2, 79),
  },
  {
    keys: ["jamur"],
    per100: n(22, 3.1, 3.3, 0.3, 2, 1, 5),
  },
  {
    keys: ["alpukat"],
    per100: n(160, 2, 8.5, 15, 0.7, 6.7, 7),
  },
  {
    keys: ["lemon segar", "lemon", "jeruk nipis", "jeruk limau"],
    per100: n(29, 1.1, 9.3, 0.3, 2.5, 2.8, 2),
  },
  {
    keys: ["daun salam"],
    per100: n(30, 1, 7, 0.5, 0, 0, 5),
  },
  {
    keys: ["kunyit"],
    per100: n(70, 1.5, 15, 0.7, 1, 3, 20),
  },
  {
    keys: ["lengkuas"],
    per100: n(71, 2, 15, 0.8, 1, 2, 20),
  },
  {
    keys: ["ketumbar"],
    per100: n(298, 12, 55, 18, 1, 42, 35),
  },

  // SUSU, KEJU, DAN PRODUK OLAHAN
  {
    keys: ["keju parmesan", "parmesan"],
    per100: n(392, 36, 3.2, 26, 0.8, 0, 1529),
    allergens: ["Susu"],
  },
  {
    keys: ["keju mozzarella", "mozzarella"],
    per100: n(280, 28, 3, 17, 1, 0, 620),
    allergens: ["Susu"],
  },
  {
    keys: ["keju cheddar", "keju slice", "keju"],
    per100: n(402, 25, 1.3, 33, 0.5, 0, 621),
    allergens: ["Susu"],
  },
  {
    keys: ["whipping cream", "heavy cream", "krim susu"],
    per100: n(340, 2, 3, 36, 3, 0, 40),
    allergens: ["Susu"],
  },
  {
    keys: ["susu kental manis", "skm"],
    per100: n(320, 7.5, 54, 8, 54, 0, 120),
    allergens: ["Susu"],
  },
  {
    keys: ["susu evaporasi", "evaporated milk"],
    per100: n(134, 7, 10, 7.5, 10, 0, 100),
    allergens: ["Susu"],
  },
  {
    keys: ["susu full cream", "susu cair", "susu UHT", "susu segar", "susu"],
    per100: n(61, 3.2, 4.8, 3.3, 4.8, 0, 43),
    allergens: ["Susu"],
  },
  {
    keys: ["susu almond"],
    per100: n(24, 0.6, 3, 1.1, 2, 0.5, 50),
    allergens: ["Kacang"],
  },
  {
    keys: ["susu oat", "oat milk"],
    per100: n(46, 1, 7, 1.5, 3, 0.8, 40),
  },
  {
    keys: ["susu kedelai", "soy milk"],
    per100: n(45, 3.3, 4, 1.8, 2, 0.6, 40),
    allergens: ["Kedelai"],
  },
  {
    keys: ["yogurt greek", "greek yogurt", "yogurt"],
    per100: n(61, 10, 3.6, 0.4, 3.2, 0, 36),
    allergens: ["Susu"],
  },
  {
    keys: ["mentega", "butter"],
    per100: n(717, 0.9, 0.1, 81, 0.1, 0, 11),
    allergens: ["Susu"],
  },
  {
    keys: ["margarin", "margarine"],
    per100: n(717, 0.2, 0.7, 80, 0.5, 0, 800),
  },
  {
    keys: ["es krim"],
    per100: n(207, 3.5, 24, 11, 21, 0.7, 80),
    allergens: ["Susu"],
  },

  // SAUS, MINYAK, DAN PEMANIS
  {
    keys: ["dressing caesar", "saus caesar", "caesar dressing", "caesar"],
    per100: n(190, 3, 8, 17, 2, 0, 900),
    allergens: ["Telur", "Ikan"],
  },
  {
    keys: ["mayones", "mayo", "mayonnaise"],
    per100: n(680, 1, 0.6, 75, 0.6, 0, 635),
    allergens: ["Telur"],
  },
  {
    keys: ["saus teriyaki", "teriyaki"],
    per100: n(140, 3.5, 30, 0.2, 24, 0.2, 1200),
    allergens: ["Kedelai", "Gandum"],
  },
  {
    keys: ["saus tiram"],
    per100: n(100, 2, 20, 1, 10, 0, 2500),
    allergens: ["Moluska"],
  },
  {
    keys: ["kecap manis", "kecap"],
    per100: n(140, 3.5, 30, 0.2, 24, 0.2, 1200),
    allergens: ["Kedelai", "Gandum"],
  },
  {
    keys: ["kecap asin", "soy sauce"],
    per100: n(53, 8, 5, 0.6, 0.4, 0.8, 5493),
    allergens: ["Kedelai", "Gandum"],
  },
  {
    keys: ["saus tomat", "ketchup"],
    per100: n(110, 1.5, 27, 0.2, 23, 0.3, 907),
  },
  {
    keys: ["saus sambal", "sambal botol"],
    per100: n(100, 1.5, 23, 0.5, 18, 1, 1200),
  },
  {
    keys: ["saus cokelat", "chocolate sauce", "saus chocolate", "cokelat cair"],
    per100: n(280, 2, 65, 2, 55, 2, 100),
    allergens: ["Susu"],
  },
  {
    keys: ["saus karamel", "caramel sauce"],
    per100: n(320, 1, 75, 5, 65, 0, 150),
    allergens: ["Susu"],
  },
  {
    keys: ["sirup cranberry", "cranberry syrup"],
    per100: n(260, 0, 65, 0, 65, 0, 5),
  },
  {
    keys: ["sirup gula", "simple syrup", "sugar syrup"],
    per100: n(260, 0, 65, 0, 65, 0, 5),
  },
  {
    keys: ["sirup vanilla", "vanilla syrup"],
    per100: n(260, 0, 65, 0, 65, 0, 5),
  },
  {
    keys: ["sirup hazelnut", "hazelnut syrup"],
    per100: n(260, 0, 65, 0, 65, 0, 5),
    allergens: ["Kacang"],
  },
  {
    keys: ["sirup karamel", "caramel syrup"],
    per100: n(260, 0, 65, 0, 65, 0, 5),
  },
  {
    keys: ["gula aren", "palm sugar"],
    per100: n(380, 0, 98, 0, 95, 0, 10),
  },
  {
    keys: ["gula merah"],
    per100: n(380, 0, 98, 0, 95, 0, 10),
  },
  {
    keys: ["gula pasir", "gula"],
    per100: n(387, 0, 100, 0, 100, 0, 1),
  },
  {
    keys: ["madu"],
    per100: n(304, 0.3, 82, 0, 82, 0.2, 4),
  },
  {
    keys: ["minyak goreng", "minyak zaitun", "olive oil", "minyak"],
    per100: n(884, 0, 0, 100, 0, 0, 0),
  },
  {
    keys: ["garam"],
    per100: n(0, 0, 0, 0, 0, 0, 38758),
  },
  {
    keys: ["kaldu ayam", "kaldu sapi", "kaldu bubuk", "kaldu"],
    per100: n(15, 1, 2, 0.5, 0.5, 0, 3000),
  },
  {
    keys: ["lada hitam", "black pepper", "lada", "merica"],
    per100: n(251, 10.4, 64, 3.3, 0.6, 25.3, 20),
  },

  // BUAH
  {
    keys: ["strawberry", "stroberi"],
    per100: n(32, 0.7, 7.7, 0.3, 4.9, 2, 1),
  },
  {
    keys: ["blueberry"],
    per100: n(57, 0.7, 14.5, 0.3, 10, 2.4, 1),
  },
  {
    keys: ["cranberry"],
    per100: n(46, 0.4, 12, 0.1, 4, 4.6, 2),
  },
  {
    keys: ["mangga", "mango"],
    per100: n(60, 0.8, 15, 0.4, 13.7, 1.6, 1),
  },
  {
    keys: ["pisang"],
    per100: n(89, 1.1, 23, 0.3, 12, 2.6, 1),
  },
  {
    keys: ["nanas"],
    per100: n(50, 0.5, 13, 0.1, 10, 1.4, 1),
  },
  {
    keys: ["semangka"],
    per100: n(30, 0.6, 7.6, 0.2, 6.2, 0.4, 1),
  },
  {
    keys: ["melon"],
    per100: n(34, 0.8, 8.2, 0.2, 7.9, 0.9, 16),
  },
  {
    keys: ["apel"],
    per100: n(52, 0.3, 14, 0.2, 10, 2.4, 1),
  },
  {
    keys: ["jeruk"],
    per100: n(47, 0.9, 12, 0.1, 9, 2.4, 0),
  },
  {
    keys: ["alpukat"],
    per100: n(160, 2, 8.5, 15, 0.7, 6.7, 7),
  },
  {
    keys: ["kurma"],
    per100: n(282, 2.5, 75, 0.4, 63, 8, 2),
  },

  // KOPI, COKELAT, TEH, DAN MINUMAN SERBUK
  {
    keys: ["espresso", "kopi espresso", "shot espresso"],
    per100: n(9, 0.1, 1.7, 0.2, 0, 0, 14),
  },
  {
    keys: ["kopi hitam", "kopi seduh", "kopi", "coffee"],
    per100: n(2, 0.1, 0, 0, 0, 0, 5),
  },
  {
    keys: ["bubuk milo", "milo powder", "milo"],
    per100: n(400, 8, 75, 8, 55, 4, 250),
    allergens: ["Susu"],
  },
  {
    keys: ["bubuk matcha", "matcha powder", "matcha"],
    per100: n(324, 30, 39, 5, 0, 38, 10),
  },
  {
    keys: ["bubuk kakao", "cocoa powder", "kakao"],
    per100: n(228, 20, 58, 14, 1.8, 33, 21),
  },
  {
    keys: ["bubuk cokelat", "chocolate powder", "cokelat bubuk"],
    per100: n(380, 5, 80, 5, 65, 5, 250),
    allergens: ["Susu"],
  },
  {
    keys: ["bubuk taro", "taro powder", "taro"],
    per100: n(380, 2, 90, 1, 65, 1, 200),
  },
  {
    keys: ["bubuk red velvet", "red velvet powder"],
    per100: n(380, 4, 85, 4, 60, 2, 250),
  },
  {
    keys: ["teh hijau", "green tea"],
    per100: n(1, 0, 0.2, 0, 0, 0, 1),
  },
  {
    keys: ["teh hitam", "black tea", "teh"],
    per100: n(1, 0, 0.3, 0, 0, 0, 3),
  },
  {
    keys: ["air kelapa", "coconut water"],
    per100: n(19, 0.7, 3.7, 0.2, 2.6, 1, 105),
  },
  {
    keys: ["santan"],
    per100: n(230, 2.3, 5.5, 23.8, 3.3, 2.2, 15),
  },
  {
    keys: ["air mineral", "air matang", "air"],
    per100: n(0, 0, 0, 0, 0, 0, 0),
  },
  {
    keys: ["es batu", "es"],
    per100: n(0, 0, 0, 0, 0, 0, 0),
  },
  {
    keys: ["arang aktif", "activated charcoal", "charcoal", "arang"],
    per100: n(0, 0, 0, 0, 0, 0, 0),
  },
];

/** Dipakai hanya jika bahan belum ditemukan dalam database. */
const GENERIC: Per100 = n(120, 8, 15, 4, 2, 2, 150);

/** Normalisasi teks agar variasi huruf dan tanda baca tetap cocok. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function findIngredient(name: string): DbEntry | null {
  const query = norm(name);
  if (!query) return null;

  let best: { entry: DbEntry; length: number } | null = null;

  for (const entry of INGREDIENT_DB) {
    for (const keyword of entry.keys) {
      const key = norm(keyword);
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const hit = new RegExp(`(^| )${escaped}( |$)`).test(query);

      // Kata terpanjang dipilih supaya "susu kental manis"
      // tidak dianggap sebagai susu biasa.
      if (hit && (!best || key.length > best.length)) {
        best = { entry, length: key.length };
      }
    }
  }

  return best?.entry ?? null;
}

/**
 * Konversi ke gram ekuivalen untuk estimasi gizi.
 * 1 ml dianggap sekitar 1 gram; kepadatan bahan berbeda-beda.
 */
export function toGrams(
  quantity: number,
  unit: string,
): number | null {
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  switch (norm(unit)) {
    case "g":
    case "gr":
    case "gram":
    case "gramm":
      return quantity;
    case "kg":
    case "kilogram":
      return quantity * 1000;
    case "mg":
      return quantity / 1000;
    case "ml":
    case "mililiter":
      return quantity;
    case "l":
    case "liter":
      return quantity * 1000;
    default:
      return null;
  }
}

const r1 = (value: number) => Math.round(value * 10) / 10;

export function calculateNutrition(
  items: IngredientInput[],
): NutritionResult {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
    sodium: 0,
  };

  let weight = 0;
  const unknown: string[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;

    const grams = toGrams(item.quantity, item.unit);
    if (grams === null) {
      skipped.push(name);
      continue;
    }

    const hit = findIngredient(name);
    if (!hit && !unknown.includes(name)) unknown.push(name);

    const per100 = hit?.per100 ?? GENERIC;
    const factor = grams / 100;

    weight += grams;
    totals.calories += per100.calories * factor;
    totals.protein += per100.protein * factor;
    totals.carbs += per100.carbs * factor;
    totals.fat += per100.fat * factor;
    totals.sugar += per100.sugar * factor;
    totals.fiber += per100.fiber * factor;
    totals.sodium += per100.sodium * factor;
  }

  return {
    totalWeight: Math.round(weight),
    calories: Math.round(totals.calories),
    protein: r1(totals.protein),
    carbs: r1(totals.carbs),
    fat: r1(totals.fat),
    sugar: r1(totals.sugar),
    fiber: r1(totals.fiber),
    sodium: Math.round(totals.sodium),
    unknown,
    skipped,
  };
}

export function detectAllergens(names: string[]): string[] {
  const found = new Set<string>();

  for (const name of names) {
    findIngredient(name)?.allergens?.forEach((allergen) =>
      found.add(allergen),
    );
  }

  return [...found].sort((a, b) => a.localeCompare(b, "id"));
}

type RecipeItem = [name: string, quantity: number, unit?: string];

type RecipeTemplate = {
  match: RegExp;
  items: RecipeItem[];
};

/**
 * Resep perkiraan per porsi.
 * Pola yang spesifik harus berada sebelum pola yang lebih umum.
 * Semua jumlah wajib diperiksa dan disesuaikan dengan resep asli.
 */
const TEMPLATES: RecipeTemplate[] = [
  // =========================================================
  // MARTABAK, JAJANAN, DAN ROTI
  // =========================================================
  {
    match: /\b(martabak telur|martabak telor|martabak asin|martabak gurih)\b/,
    items: [
      ["Tepung terigu", 100],
      ["Telur", 100],
      ["Daging sapi", 60],
      ["Daun bawang", 20],
      ["Bawang merah", 10],
      ["Minyak goreng", 20],
      ["Garam", 2],
    ],
  },
  {
    match: /\b(martabak manis|terang bulan|martabak bangka|martabak cokelat|martabak keju|martabak kacang)\b/,
    items: [
      ["Tepung terigu", 100],
      ["Telur", 50],
      ["Susu cair", 50, "ml"],
      ["Gula pasir", 25],
      ["Mentega", 15],
      ["Cokelat bubuk", 10],
      ["Keju cheddar", 20],
      ["Susu kental manis", 20],
    ],
  },
  {
    match: /\b(martabak mini|mini martabak)\b/,
    items: [
      ["Tepung terigu", 70],
      ["Telur", 35],
      ["Susu cair", 35, "ml"],
      ["Gula pasir", 20],
      ["Mentega", 10],
      ["Cokelat bubuk", 8],
      ["Susu kental manis", 10],
    ],
  },
  {
    match: /\b(martabak)\b/,
    items: [
      ["Tepung terigu", 100],
      ["Telur", 50],
      ["Susu cair", 40, "ml"],
      ["Gula pasir", 20],
      ["Mentega", 10],
      ["Cokelat bubuk", 10],
      ["Keju cheddar", 15],
      ["Susu kental manis", 15],
    ],
  },
  {
    match: /\b(pisang goreng|banana fritter)\b/,
    items: [
      ["Pisang", 120],
      ["Tepung terigu", 40],
      ["Gula pasir", 5],
      ["Minyak goreng", 15],
    ],
  },
  {
    match: /\b(pisang cokelat|piscok|banana chocolate)\b/,
    items: [
      ["Pisang", 80],
      ["Kulit lumpia", 30],
      ["Saus cokelat", 20],
      ["Minyak goreng", 10],
    ],
  },
  {
    match: /\b(serabi|surabi)\b/,
    items: [
      ["Tepung beras", 70],
      ["Santan", 80, "ml"],
      ["Gula merah", 20],
      ["Garam", 1],
    ],
  },
  {
    match: /\b(cireng)\b/,
    items: [
      ["Tepung tapioka", 80],
      ["Tepung terigu", 20],
      ["Bawang putih", 3],
      ["Garam", 2],
      ["Minyak goreng", 12],
    ],
  },
  {
    match: /\b(cilok)\b/,
    items: [
      ["Tepung tapioka", 70],
      ["Tepung terigu", 30],
      ["Bawang putih", 3],
      ["Saus sambal", 20],
    ],
  },
  {
    match: /\b(pempek|empek empek)\b/,
    items: [
      ["Ikan tenggiri", 80],
      ["Tepung tapioka", 70],
      ["Telur", 30],
      ["Saus sambal", 30],
      ["Gula merah", 10],
    ],
  },
  {
    match: /\b(batagor)\b/,
    items: [
      ["Tahu", 70],
      ["Tepung tapioka", 30],
      ["Ikan tenggiri", 30],
      ["Minyak goreng", 12],
      ["Kacang tanah", 20],
    ],
  },
  {
    match: /\b(si[o]?may|dimsum)\b/,
    items: [
      ["Daging sapi", 40],
      ["Udang", 30],
      ["Tepung terigu", 20],
      ["Telur", 20],
      ["Wortel", 15],
      ["Saus sambal", 15],
    ],
  },
  {
    match: /\b(roti bakar|toast)\b/,
    items: [
      ["Roti tawar", 80],
      ["Mentega", 10],
      ["Susu kental manis", 15],
      ["Saus cokelat", 15],
      ["Keju cheddar", 15],
    ],
  },
  {
    match: /\b(pancake|panekuk)\b/,
    items: [
      ["Tepung terigu", 70],
      ["Telur", 50],
      ["Susu cair", 80, "ml"],
      ["Gula pasir", 15],
      ["Mentega", 10],
      ["Madu", 15],
    ],
  },
  {
    match: /\b(waffle|wafel)\b/,
    items: [
      ["Tepung terigu", 80],
      ["Telur", 50],
      ["Susu cair", 70, "ml"],
      ["Gula pasir", 15],
      ["Mentega", 15],
      ["Madu", 10],
    ],
  },
  {
    match: /\b(donat|doughnut)\b/,
    items: [
      ["Tepung terigu", 80],
      ["Susu cair", 30, "ml"],
      ["Telur", 25],
      ["Gula pasir", 15],
      ["Mentega", 10],
      ["Minyak goreng", 10],
    ],
  },
  {
    match: /\b(brownies)\b/,
    items: [
      ["Tepung terigu", 35],
      ["Telur", 30],
      ["Gula pasir", 30],
      ["Mentega", 25],
      ["Bubuk kakao", 15],
      ["Cokelat cair", 20],
    ],
  },
  {
    match: /\b(cookies|kukis|kue kering)\b/,
    items: [
      ["Tepung terigu", 50],
      ["Mentega", 25],
      ["Gula pasir", 20],
      ["Telur", 15],
      ["Cokelat bubuk", 10],
    ],
  },
  {
    match: /\b(roti maryam|canai|paratha)\b/,
    items: [
      ["Tepung terigu", 100],
      ["Mentega", 15],
      ["Susu cair", 20, "ml"],
      ["Gula pasir", 5],
      ["Garam", 1],
    ],
  },
  {
    match: /\b(ketoprak)\b/,
    items: [
      ["Tahu", 80],
      ["Bihun", 70],
      ["Ketimun", 40],
      ["Tauge", 30],
      ["Kacang tanah", 25],
      ["Kecap manis", 10],
    ],
  },
  {
    match: /\b(gado gado|gado-gado)\b/,
    items: [
      ["Tahu", 60],
      ["Tempe", 50],
      ["Sayuran", 150],
      ["Kentang", 60],
      ["Telur", 50],
      ["Kacang tanah", 30],
    ],
  },
  {
    match: /\b(rujak buah|rujak)\b/,
    items: [
      ["Mangga", 60],
      ["Nanas", 60],
      ["Timun", 60],
      ["Gula merah", 20],
      ["Kacang tanah", 15],
    ],
  },

  // =========================================================
  // MASAKAN INDONESIA
  // =========================================================
  {
    match: /\b(ayam rica rica|rica rica ayam|rica rica)\b/,
    items: [
      ["Ayam", 150],
      ["Cabai merah", 15],
      ["Cabai rawit", 5],
      ["Bawang merah", 15],
      ["Bawang putih", 8],
      ["Jahe", 5],
      ["Serai", 5],
      ["Daun jeruk", 2],
      ["Minyak goreng", 10],
      ["Garam", 2],
    ],
  },
  {
    match: /\b(ayam geprek|geprek ayam)\b/,
    items: [
      ["Ayam", 150],
      ["Tepung terigu", 30],
      ["Minyak goreng", 20],
      ["Cabai rawit", 15],
      ["Bawang putih", 5],
      ["Garam", 2],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ayam penyet)\b/,
    items: [
      ["Ayam", 150],
      ["Minyak goreng", 15],
      ["Cabai merah", 10],
      ["Bawang merah", 10],
      ["Nasi putih", 180],
      ["Timun", 30],
    ],
  },
  {
    match: /\b(ayam bakar|grilled chicken)\b/,
    items: [
      ["Ayam", 180],
      ["Kecap manis", 15],
      ["Bawang putih", 5],
      ["Bawang merah", 10],
      ["Minyak goreng", 5],
      ["Garam", 2],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ayam goreng|fried chicken)\b/,
    items: [
      ["Ayam", 150],
      ["Tepung terigu", 25],
      ["Bawang putih", 5],
      ["Garam", 2],
      ["Minyak goreng", 15],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ayam kecap)\b/,
    items: [
      ["Ayam", 150],
      ["Kecap manis", 20],
      ["Bawang merah", 15],
      ["Bawang putih", 5],
      ["Minyak goreng", 8],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ayam woku|woku)\b/,
    items: [
      ["Ayam", 150],
      ["Cabai merah", 10],
      ["Bawang merah", 15],
      ["Bawang putih", 5],
      ["Jahe", 5],
      ["Serai", 5],
      ["Daun jeruk", 2],
      ["Minyak goreng", 8],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ayam opor|opor ayam|opor)\b/,
    items: [
      ["Ayam", 150],
      ["Santan", 100, "ml"],
      ["Bawang merah", 15],
      ["Bawang putih", 5],
      ["Kunyit", 3],
      ["Serai", 5],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(rendang|daging rendang)\b/,
    items: [
      ["Daging sapi", 150],
      ["Santan", 80, "ml"],
      ["Bawang merah", 20],
      ["Bawang putih", 8],
      ["Cabai merah", 10],
      ["Jahe", 5],
      ["Serai", 5],
      ["Garam", 2],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(sate ayam|satai ayam)\b/,
    items: [
      ["Ayam", 120],
      ["Kecap manis", 15],
      ["Kacang tanah", 25],
      ["Bawang merah", 10],
      ["Nasi putih", 150],
    ],
  },
  {
    match: /\b(sate kambing|satai kambing)\b/,
    items: [
      ["Daging kambing", 150],
      ["Kecap manis", 15],
      ["Bawang merah", 15],
      ["Nasi putih", 150],
    ],
  },
  {
    match: /\b(soto ayam|soto)\b/,
    items: [
      ["Ayam", 100],
      ["Nasi putih", 150],
      ["Bawang putih", 5],
      ["Bawang merah", 10],
      ["Kaldu ayam", 100, "ml"],
      ["Sayuran", 30],
      ["Garam", 2],
    ],
  },
  {
    match: /\b(rawon)\b/,
    items: [
      ["Daging sapi", 120],
      ["Kaldu sapi", 150, "ml"],
      ["Bawang merah", 15],
      ["Bawang putih", 5],
      ["Kunyit", 3],
      ["Nasi putih", 180],
      ["Tauge", 20],
    ],
  },
  {
    match: /\b(bakso|bakso sapi)\b/,
    items: [
      ["Bakso sapi", 100],
      ["Mie", 80],
      ["Kaldu sapi", 200, "ml"],
      ["Daun bawang", 5],
      ["Bawang putih", 3],
    ],
  },
  {
    match: /\b(nasi goreng|fried rice)\b/,
    items: [
      ["Nasi putih", 200],
      ["Telur", 50],
      ["Ayam", 40],
      ["Bawang putih", 5],
      ["Sayuran", 30],
      ["Kecap manis", 10],
      ["Minyak goreng", 8],
    ],
  },
  {
    match: /\b(nasi uduk)\b/,
    items: [
      ["Nasi putih", 200],
      ["Santan", 50, "ml"],
      ["Ayam", 50],
      ["Telur", 30],
      ["Minyak goreng", 5],
    ],
  },
  {
    match: /\b(nasi kuning)\b/,
    items: [
      ["Nasi putih", 200],
      ["Santan", 40, "ml"],
      ["Ayam", 50],
      ["Telur", 30],
      ["Minyak goreng", 5],
    ],
  },
  {
    match: /\b(nasi padang|nasi rendang)\b/,
    items: [
      ["Nasi putih", 200],
      ["Daging sapi", 120],
      ["Santan", 50, "ml"],
      ["Cabai merah", 10],
      ["Sayuran", 30],
    ],
  },
  {
    match: /\b(nasi liwet)\b/,
    items: [
      ["Nasi putih", 200],
      ["Santan", 30, "ml"],
      ["Ayam", 50],
      ["Bawang merah", 10],
      ["Minyak goreng", 5],
    ],
  },
  {
    match: /\b(nasi bakar)\b/,
    items: [
      ["Nasi putih", 200],
      ["Ayam", 70],
      ["Santan", 20, "ml"],
      ["Bawang merah", 10],
      ["Cabai merah", 5],
    ],
  },
  {
    match: /\b(pecel lele|lele goreng)\b/,
    items: [
      ["Ikan lele", 150],
      ["Minyak goreng", 15],
      ["Nasi putih", 180],
      ["Cabai merah", 10],
      ["Timun", 30],
    ],
  },
  {
    match: /\b(ikan bakar)\b/,
    items: [
      ["Ikan nila", 180],
      ["Kecap manis", 10],
      ["Bawang putih", 5],
      ["Cabai merah", 5],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(ikan goreng)\b/,
    items: [
      ["Ikan nila", 180],
      ["Tepung terigu", 10],
      ["Minyak goreng", 15],
      ["Garam", 2],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(pindang ikan|pindang patin|pindang)\b/,
    items: [
      ["Ikan nila", 150],
      ["Tomat", 30],
      ["Cabai merah", 5],
      ["Bawang merah", 10],
      ["Air", 150, "ml"],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(gulai ayam|gulai kambing|gulai sapi|gulai)\b/,
    items: [
      ["Ayam", 120],
      ["Santan", 100, "ml"],
      ["Bawang merah", 15],
      ["Bawang putih", 5],
      ["Kunyit", 3],
      ["Cabai merah", 5],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(semur daging|semur)\b/,
    items: [
      ["Daging sapi", 120],
      ["Kentang", 80],
      ["Kecap manis", 20],
      ["Bawang merah", 10],
      ["Bawang putih", 5],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(orek tempe|tempe orek)\b/,
    items: [
      ["Tempe", 120],
      ["Kecap manis", 15],
      ["Bawang merah", 10],
      ["Cabai merah", 5],
      ["Minyak goreng", 8],
      ["Nasi putih", 180],
    ],
  },
  {
    match: /\b(tahu goreng)\b/,
    items: [
      ["Tahu", 150],
      ["Minyak goreng", 10],
      ["Garam", 1],
    ],
  },
  {
    match: /\b(tempe goreng)\b/,
    items: [
      ["Tempe", 150],
      ["Minyak goreng", 10],
      ["Garam", 1],
    ],
  },
  {
    match: /\b(perkedel kentang|perkedel)\b/,
    items: [
      ["Kentang", 120],
      ["Telur", 25],
      ["Bawang merah", 5],
      ["Minyak goreng", 10],
    ],
  },
  {
    match: /\b(ketupat sayur)\b/,
    items: [
      ["Nasi putih", 180],
      ["Santan", 100, "ml"],
      ["Sayuran", 80],
      ["Telur", 50],
    ],
  },
  {
    match: /\b(lontong sayur|lontong)\b/,
    items: [
      ["Nasi putih", 180],
      ["Santan", 80, "ml"],
      ["Sayuran", 80],
      ["Telur", 40],
    ],
  },

  // =========================================================
  // MAKANAN KAFE DAN BARAT
  // =========================================================
  {
    match: /\b(beef steak|steak sapi|steak daging|beef|steak)\b/,
    items: [
      ["Daging sapi", 180],
      ["Kentang", 150],
      ["Mentega", 10],
      ["Bawang putih", 5],
      ["Lada hitam", 2],
      ["Garam", 2],
      ["Saus", 30],
    ],
  },
  {
    match: /\b(chicken steak|steak ayam)\b/,
    items: [
      ["Ayam", 180],
      ["Kentang", 120],
      ["Mentega", 8],
      ["Saus", 30],
      ["Sayuran", 50],
    ],
  },
  {
    match: /\b(chicken rice bowl|rice bowl ayam|ayam rice bowl|chicken bowl)\b/,
    items: [
      ["Ayam panggang", 150],
      ["Nasi putih", 150],
      ["Sayuran", 60],
      ["Saus teriyaki", 20],
    ],
  },
  {
    match: /\b(burger|hamburger)\b/,
    items: [
      ["Daging sapi", 100],
      ["Roti burger", 70],
      ["Keju cheddar", 15],
      ["Selada", 15],
      ["Tomat", 20],
      ["Mayones", 10],
    ],
  },
  {
    match: /\b(hot dog)\b/,
    items: [
      ["Sosis", 70],
      ["Roti burger", 70],
      ["Saus tomat", 10],
      ["Mayones", 10],
    ],
  },
  {
    match: /\b(club sandwich|sandwich|roti lapis)\b/,
    items: [
      ["Roti tawar", 90],
      ["Ayam", 60],
      ["Telur", 30],
      ["Keju cheddar", 15],
      ["Selada", 15],
      ["Mayones", 10],
    ],
  },
  {
    match: /\b(french fries|kentang goreng|fries)\b/,
    items: [
      ["Kentang", 180],
      ["Minyak goreng", 15],
      ["Garam", 2],
      ["Saus tomat", 15],
    ],
  },
  {
    match: /\b(chicken wings|sayap ayam)\b/,
    items: [
      ["Ayam", 180],
      ["Saus sambal", 20],
      ["Kecap manis", 10],
      ["Minyak goreng", 10],
    ],
  },
  {
    match: /\b(chicken katsu|katsu ayam)\b/,
    items: [
      ["Ayam", 150],
      ["Tepung terigu", 20],
      ["Telur", 25],
      ["Minyak goreng", 15],
      ["Nasi putih", 180],
      ["Saus teriyaki", 15],
    ],
  },
  {
    match: /\b(caesar salad|salad caesar)\b/,
    items: [
      ["Selada romaine", 150],
      ["Dressing caesar", 30],
      ["Roti tawar", 20],
      ["Keju parmesan", 15],
      ["Ayam", 80],
    ],
  },
  {
    match: /\b(salad buah|fruit salad)\b/,
    items: [
      ["Strawberry", 30],
      ["Mangga", 40],
      ["Apel", 40],
      ["Yogurt", 50],
      ["Keju cheddar", 10],
    ],
  },
  {
    match: /\b(spaghetti bolognese|bolognese)\b/,
    items: [
      ["Pasta", 180],
      ["Daging sapi", 70],
      ["Saus tomat", 60],
      ["Bawang putih", 5],
      ["Keju parmesan", 10],
      ["Minyak goreng", 5],
    ],
  },
  {
    match: /\b(spaghetti carbonara|carbonara)\b/,
    items: [
      ["Pasta", 180],
      ["Susu cair", 80, "ml"],
      ["Keju parmesan", 20],
      ["Daging asap", 40],
      ["Telur", 30],
      ["Mentega", 5],
    ],
  },
  {
    match: /\b(spaghetti aglio|aglio olio|aglio e olio)\b/,
    items: [
      ["Pasta", 180],
      ["Minyak zaitun", 15],
      ["Bawang putih", 8],
      ["Cabai merah", 3],
      ["Udang", 60],
    ],
  },
  {
    match: /\b(spaghetti|pasta|macaroni|makaroni)\b/,
    items: [
      ["Pasta", 180],
      ["Saus tomat", 60],
      ["Daging sapi", 50],
      ["Keju cheddar", 15],
      ["Minyak goreng", 5],
    ],
  },
  {
    match: /\b(pizza)\b/,
    items: [
      ["Tepung terigu", 100],
      ["Saus tomat", 30],
      ["Keju mozzarella", 60],
      ["Sosis", 40],
      ["Jamur", 20],
    ],
  },
  {
    match: /\b(mac and cheese|mac n cheese|macaroni cheese)\b/,
    items: [
      ["Makaroni", 100],
      ["Susu cair", 80, "ml"],
      ["Keju cheddar", 35],
      ["Mentega", 8],
      ["Tepung terigu", 8],
    ],
  },
  {
    match: /\b(nugget ayam|chicken nugget|nugget)\b/,
    items: [
      ["Ayam", 120],
      ["Tepung terigu", 20],
      ["Telur", 20],
      ["Minyak goreng", 12],
      ["Saus tomat", 15],
    ],
  },
  {
    match: /\b(fish and chips|fish n chips)\b/,
    items: [
      ["Ikan nila", 150],
      ["Tepung terigu", 30],
      ["Kentang", 150],
      ["Minyak goreng", 15],
    ],
  },
  {
    match: /\b(nasi putih|steamed rice)\b/,
    items: [["Nasi putih", 200]],
  },
  {
    match: /\b(salmon)\b/,
    items: [
      ["Salmon", 150],
      ["Nasi merah", 150],
      ["Brokoli", 80],
      ["Saus teriyaki", 20],
    ],
  },
  {
    match: /\b(mie goreng|mi goreng|fried noodle)\b/,
    items: [
      ["Mie", 180],
      ["Telur", 50],
      ["Ayam", 50],
      ["Sayuran", 40],
      ["Minyak goreng", 8],
      ["Kecap manis", 10],
    ],
  },
  {
    match: /\b(indomie|mie instan|mi instan)\b/,
    items: [
      ["Mie instan", 85],
      ["Telur", 50],
      ["Sayuran", 30],
    ],
  },

  // =========================================================
  // MINUMAN KAFE
  // =========================================================
  {
    match: /\b(ice mocha|iced mocha|es mocha|mocha ice|mocha latte)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 150, "ml"],
      ["Saus cokelat", 20],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(white chocolate mocha|white mocha)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 150, "ml"],
      ["Saus cokelat", 20],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(americano|long black|black coffee|es kopi hitam)\b/,
    items: [
      ["Espresso", 60, "ml"],
      ["Air", 120, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(cappuccino|kapucino)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 120, "ml"],
      ["Susu kental manis", 5],
    ],
  },
  {
    match: /\b(cafe latte|caffe latte|cafe latte|latte|es latte)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 180, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(flat white)\b/,
    items: [
      ["Espresso", 40, "ml"],
      ["Susu cair", 140, "ml"],
    ],
  },
  {
    match: /\b(macchiato)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 30, "ml"],
    ],
  },
  {
    match: /\b(affogato)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Es krim", 100],
    ],
  },
  {
    match: /\b(conhiello|kopi susu pekat)\b/,
    items: [
      ["Espresso", 40, "ml"],
      ["Susu kental manis", 25],
      ["Susu cair", 60, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(kopi susu milodino|milodino)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 120, "ml"],
      ["Bubuk Milo", 20],
      ["Susu kental manis", 15],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(kopi susu nnorte|nnorte coffee)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 120, "ml"],
      ["Gula aren", 20],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(kopi susu gula aren|aren latte|palm sugar latte)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 120, "ml"],
      ["Gula aren", 20],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(es kopi susu|iced coffee|kopi susu)\b/,
    items: [
      ["Espresso", 30, "ml"],
      ["Susu cair", 120, "ml"],
      ["Sirup gula", 15, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(espresso)\b/,
    items: [["Espresso", 30, "ml"]],
  },
  {
    match: /\b(vietnam drip|kopi vietnam)\b/,
    items: [
      ["Kopi seduh", 60, "ml"],
      ["Susu kental manis", 25],
      ["Air", 60, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(v60|pour over|manual brew|filter coffee)\b/,
    items: [
      ["Kopi seduh", 200, "ml"],
    ],
  },
  {
    match: /\b(matcha latte|es matcha|green tea latte)\b/,
    items: [
      ["Bubuk matcha", 4],
      ["Susu cair", 180, "ml"],
      ["Sirup gula", 15, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(matcha)\b/,
    items: [
      ["Bubuk matcha", 4],
      ["Air", 200, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(red velvet latte|red velvet)\b/,
    items: [
      ["Bubuk red velvet", 20],
      ["Susu cair", 180, "ml"],
      ["Susu kental manis", 10],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(taro latte|taro milk|taro)\b/,
    items: [
      ["Bubuk taro", 20],
      ["Susu cair", 180, "ml"],
      ["Susu kental manis", 10],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(chocolate milk|milk chocolate|es cokelat|cokelat susu|hot chocolate|chocolate)\b/,
    items: [
      ["Bubuk cokelat", 20],
      ["Susu cair", 180, "ml"],
      ["Susu kental manis", 10],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(milo dinosaur|dinosaurus milo|milo dino)\b/,
    items: [
      ["Bubuk Milo", 25],
      ["Susu cair", 180, "ml"],
      ["Susu kental manis", 15],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(es milo|milo ice|milo)\b/,
    items: [
      ["Bubuk Milo", 25],
      ["Susu cair", 180, "ml"],
      ["Susu kental manis", 10],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(thai tea|teh thailand)\b/,
    items: [
      ["Teh hitam", 100, "ml"],
      ["Susu evaporasi", 30],
      ["Susu kental manis", 25],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(cheese tea|teh keju)\b/,
    items: [
      ["Teh hitam", 180, "ml"],
      ["Gula pasir", 15],
      ["Whipping cream", 30],
      ["Keju cheddar", 10],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(milk tea|teh susu)\b/,
    items: [
      ["Teh hitam", 150, "ml"],
      ["Susu cair", 60, "ml"],
      ["Sirup gula", 15, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(lemon tea|teh lemon)\b/,
    items: [
      ["Teh hitam", 180, "ml"],
      ["Lemon segar", 20],
      ["Sirup gula", 15, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(lychee tea|leci tea|teh leci)\b/,
    items: [
      ["Teh hitam", 180, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Leci", 30],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(black cranberry|cranberry black|cranberry drink)\b/,
    items: [
      ["Cranberry", 30],
      ["Sirup cranberry", 20, "ml"],
      ["Air", 150, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(black lemonade|black lemon)\b/,
    items: [
      ["Lemon segar", 30],
      ["Sirup gula", 20, "ml"],
      ["Air", 180, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(black mangga|mangga black|black mango)\b/,
    items: [
      ["Mangga", 100],
      ["Sirup gula", 15, "ml"],
      ["Air", 100, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(black strawberry|strawberry black|black stroberi)\b/,
    items: [
      ["Strawberry", 80],
      ["Sirup gula", 20, "ml"],
      ["Air", 120, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(lemonade|lemon drink)\b/,
    items: [
      ["Lemon segar", 30],
      ["Sirup gula", 20, "ml"],
      ["Air", 200, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(jus alpukat|avocado juice)\b/,
    items: [
      ["Alpukat", 100],
      ["Susu cair", 100, "ml"],
      ["Susu kental manis", 20],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus mangga|mango juice)\b/,
    items: [
      ["Mangga", 120],
      ["Air", 100, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus strawberry|strawberry juice|jus stroberi)\b/,
    items: [
      ["Strawberry", 100],
      ["Air", 100, "ml"],
      ["Sirup gula", 15, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus jeruk|orange juice)\b/,
    items: [
      ["Jeruk", 150],
      ["Air", 50, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus nanas|pineapple juice)\b/,
    items: [
      ["Nanas", 150],
      ["Air", 100, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus semangka|watermelon juice)\b/,
    items: [
      ["Semangka", 180],
      ["Air", 50, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(jus melon|melon juice)\b/,
    items: [
      ["Melon", 150],
      ["Air", 80, "ml"],
      ["Sirup gula", 10, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(banana smoothie|smoothie pisang|smoothie)\b/,
    items: [
      ["Pisang", 100],
      ["Susu cair", 150, "ml"],
      ["Yogurt", 50],
      ["Madu", 10],
    ],
  },
  {
    match: /\b(strawberry smoothie|berry smoothie)\b/,
    items: [
      ["Strawberry", 100],
      ["Susu cair", 120, "ml"],
      ["Yogurt", 50],
      ["Madu", 10],
    ],
  },
  {
    match: /\b(milkshake strawberry|strawberry milkshake)\b/,
    items: [
      ["Strawberry", 80],
      ["Susu cair", 150, "ml"],
      ["Es krim", 80],
      ["Susu kental manis", 10],
    ],
  },
  {
    match: /\b(milkshake cokelat|chocolate milkshake|milkshake chocolate)\b/,
    items: [
      ["Susu cair", 150, "ml"],
      ["Es krim", 80],
      ["Bubuk cokelat", 15],
      ["Susu kental manis", 10],
    ],
  },
  {
    match: /\b(milkshake vanilla|vanilla milkshake)\b/,
    items: [
      ["Susu cair", 150, "ml"],
      ["Es krim", 100],
      ["Sirup vanilla", 10, "ml"],
    ],
  },
  {
    match: /\b(milkshake|milk shake)\b/,
    items: [
      ["Susu cair", 150, "ml"],
      ["Es krim", 100],
      ["Sirup gula", 10, "ml"],
    ],
  },
  {
    match: /\b(frappuccino|frappe|frappé)\b/,
    items: [
      ["Kopi seduh", 60, "ml"],
      ["Susu cair", 100, "ml"],
      ["Es krim", 60],
      ["Sirup gula", 15, "ml"],
      ["Saus cokelat", 10],
    ],
  },
  {
    match: /\b(air kelapa)\b/,
    items: [
      ["Air kelapa", 250, "ml"],
      ["Es batu", 80],
    ],
  },
  {
    match: /\b(strawberry|stroberi)\b/,
    items: [
      ["Strawberry", 100],
      ["Sirup gula", 15, "ml"],
      ["Air", 150, "ml"],
      ["Es batu", 100],
    ],
  },
  {
    match: /\b(mangga|mango)\b/,
    items: [
      ["Mangga", 120],
      ["Sirup gula", 10, "ml"],
      ["Air", 150, "ml"],
      ["Es batu", 100],
    ],
  },

  // =========================================================
  // MENU TAMBAHAN
  // =========================================================
  {
    match: /\b(bubur ayam)\b/,
    items: [
      ["Nasi putih", 150],
      ["Ayam", 50],
      ["Kaldu ayam", 150, "ml"],
      ["Telur", 30],
      ["Daun bawang", 5],
    ],
  },
  {
    match: /\b(lumpia)\b/,
    items: [
      ["Kulit lumpia", 30],
      ["Wortel", 30],
      ["Sayuran", 30],
      ["Minyak goreng", 10],
    ],
  },
  {
    match: /\b(pisang nugget)\b/,
    items: [
      ["Pisang", 100],
      ["Tepung terigu", 25],
      ["Telur", 20],
      ["Minyak goreng", 12],
      ["Saus cokelat", 15],
      ["Keju cheddar", 10],
    ],
  },
  {
    match: /\b(omelet|omelette|telur dadar)\b/,
    items: [
      ["Telur", 100],
      ["Bawang merah", 5],
      ["Daun bawang", 5],
      ["Minyak goreng", 5],
      ["Garam", 1],
    ],
  },
  {
    match: /\b(telur ceplok|telur mata sapi)\b/,
    items: [
      ["Telur", 50],
      ["Minyak goreng", 5],
      ["Garam", 1],
    ],
  },
];

export function suggestIngredients(
  menuName: string,
): { name: string; quantity: number; unit: string }[] {
  const query = norm(menuName);
  if (!query) return [];

  const template = TEMPLATES.find((item) => item.match.test(query));

  return (
    template?.items.map(([name, quantity, unit]) => ({
      name,
      quantity,
      unit: unit ?? "gram",
    })) ?? []
  );
}

export function buildDescription(args: {
  name: string;
  category: string;
  ingredients: string[];
  allergens: string[];
  nutrition: NutritionFacts;
}): string {
  const main = args.ingredients.filter(Boolean).slice(0, 3);

  const ingredientList =
    main.length > 1
      ? `${main.slice(0, -1).join(", ")} dan ${main[main.length - 1]}`
      : main[0] ?? "bahan pilihan";

  const kind = /minum|drink|beverage/i.test(args.category)
    ? "Minuman"
    : "Hidangan";

  const protein =
    args.nutrition.protein >= 20 ? " Kaya protein." : "";

  const allergens = args.allergens.length
    ? ` Mengandung ${args.allergens.join(", ").toLowerCase()}.`
    : "";

  return `${kind} ${args.name} dibuat dengan ${ingredientList}.${protein}${allergens}`
    .replace(/\s+/g, " ")
    .trim();
}

export function toFormPatch(args: {
  description: string;
  ingredients: IngredientInput[];
  allergens: string[];
}) {
  return {
    description: args.description,
    ingredients: args.ingredients
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity: String(item.quantity),
        unit: item.unit.trim(),
      })),
    allergens: args.allergens.join(", "),
  };
}
