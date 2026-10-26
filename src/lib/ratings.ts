/** Validasi & normalisasi rating sebelum dikirim ke RPC portal. */
export interface RatingSubmission {
  /** null = rating keseluruhan pesanan; UUID = rating item. */
  orderItemId: string | null;
  rating: number;
  review?: string;
}

export interface RatingPayload {
  orderRating: number | null;
  orderReview: string | null;
  items: { orderItemId: string; rating: number }[];
}

export const MAX_RATING_REVIEW = 1000;

export function buildRatingPayload(submissions: RatingSubmission[]): RatingPayload {
  if (!Array.isArray(submissions) || submissions.length === 0) {
    throw new Error('Pilih minimal satu rating.');
  }

  let overall: RatingSubmission | undefined;
  const items: RatingPayload['items'] = [];
  const seen = new Set<string>();

  for (const submission of submissions) {
    if (!Number.isInteger(submission.rating) || submission.rating < 1 || submission.rating > 5) {
      throw new Error('Rating harus antara 1 dan 5 bintang.');
    }

    if (submission.orderItemId == null) {
      if (overall) throw new Error('Rating keseluruhan hanya boleh dikirim sekali.');
      overall = submission;
      continue;
    }

    const orderItemId = submission.orderItemId.trim();
    if (!orderItemId) throw new Error('Item rating tidak valid.');
    if (submission.review?.trim()) {
      throw new Error('Ulasan hanya boleh dikirim bersama rating keseluruhan.');
    }
    if (seen.has(orderItemId)) throw new Error('Setiap item hanya boleh dinilai sekali.');
    seen.add(orderItemId);
    items.push({ orderItemId, rating: submission.rating });
  }

  const review = overall?.review?.trim() ?? '';
  if (review.length > MAX_RATING_REVIEW) {
    throw new Error(`Ulasan maksimal ${MAX_RATING_REVIEW} karakter.`);
  }
  if (review && !overall) {
    throw new Error('Pilih rating keseluruhan sebelum menulis ulasan.');
  }

  return {
    orderRating: overall?.rating ?? null,
    orderReview: review || null,
    items,
  };
}
