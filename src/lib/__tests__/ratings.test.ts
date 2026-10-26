import { describe, expect, it } from 'vitest';
import { buildRatingPayload, MAX_RATING_REVIEW } from '../ratings';

describe('buildRatingPayload', () => {
  it('memisahkan rating keseluruhan dan rating item', () => {
    expect(
      buildRatingPayload([
        { orderItemId: null, rating: 5, review: '  Mantap  ' },
        { orderItemId: 'item-1', rating: 4 },
        { orderItemId: 'item-2', rating: 3 },
      ]),
    ).toEqual({
      orderRating: 5,
      orderReview: 'Mantap',
      items: [
        { orderItemId: 'item-1', rating: 4 },
        { orderItemId: 'item-2', rating: 3 },
      ],
    });
  });

  it('mengizinkan rating item tanpa rating keseluruhan', () => {
    expect(buildRatingPayload([{ orderItemId: 'item-1', rating: 4 }])).toEqual({
      orderRating: null,
      orderReview: null,
      items: [{ orderItemId: 'item-1', rating: 4 }],
    });
  });

  it('menolak rating di luar 1-5', () => {
    expect(() => buildRatingPayload([{ orderItemId: null, rating: 0 }])).toThrow('1 dan 5');
    expect(() => buildRatingPayload([{ orderItemId: null, rating: 6 }])).toThrow('1 dan 5');
    expect(() => buildRatingPayload([{ orderItemId: null, rating: 4.5 }])).toThrow('1 dan 5');
  });

  it('menolak rating ganda untuk item atau pesanan yang sama', () => {
    expect(() =>
      buildRatingPayload([
        { orderItemId: 'item-1', rating: 4 },
        { orderItemId: 'item-1', rating: 5 },
      ]),
    ).toThrow('sekali');
    expect(() =>
      buildRatingPayload([
        { orderItemId: null, rating: 4 },
        { orderItemId: null, rating: 5 },
      ]),
    ).toThrow('sekali');
  });

  it('menolak ulasan tanpa rating keseluruhan', () => {
    expect(() => buildRatingPayload([{ orderItemId: 'item-1', rating: 4, review: 'Enak' }])).toThrow(
      'keseluruhan',
    );
  });

  it('menolak ulasan yang terlalu panjang', () => {
    expect(() =>
      buildRatingPayload([
        { orderItemId: null, rating: 5, review: 'a'.repeat(MAX_RATING_REVIEW + 1) },
      ]),
    ).toThrow(String(MAX_RATING_REVIEW));
  });

  it('menolak payload kosong atau item tanpa id', () => {
    expect(() => buildRatingPayload([])).toThrow('minimal satu');
    expect(() => buildRatingPayload([{ orderItemId: '   ', rating: 4 }])).toThrow('tidak valid');
  });
});
