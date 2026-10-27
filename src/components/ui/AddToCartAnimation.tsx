import { useRef, useState } from "react";
import type { RefObject } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { Loader2, Plus } from "lucide-react";

type Product = {
  id: string | number;
  name: string;
  price: number;
  image: string;
};

type AddToCartAnimationProps = {
  product: Product;
  onAdd: () => void;
  cartRef: RefObject<HTMLElement | null>;
};

export default function AddToCartAnimation({
  product,
  onAdd,
  cartRef,
}: AddToCartAnimationProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const flyingRef = useRef(false);
  const [isFlying, setIsFlying] = useState(false);
  const reduceMotion = useReducedMotion();

  const shakeCart = async (cart: HTMLElement) => {
    const ripple = cart.querySelector<HTMLElement>(".nnorte-cart-ripple");

    await Promise.all([
      animate(
        cart,
        {
          x: [0, -5, 6, -5, 3, 0],
          y: [0, -3, 2, -1, 1, 0],
          rotate: [0, -6, 6, -4, 2, 0],
          scale: [1, 1.08, 0.96, 1.04, 0.99, 1],
        },
        { duration: 0.48, ease: "easeOut" },
      ).finished,
      ripple
        ? animate(
            ripple,
            { scale: [0.4, 2.2], opacity: [0.8, 0] },
            { duration: 0.5, ease: "easeOut" },
          ).finished
        : Promise.resolve(),
    ]);

    // Bersihkan transform dan ripple inline agar state berikutnya dimulai bersih.
    cart.style.removeProperty("transform");
    cart.style.removeProperty("translate");
    cart.style.removeProperty("rotate");
    if (ripple) {
      ripple.style.removeProperty("transform");
      ripple.style.removeProperty("opacity");
    }
  };

  const handleAdd = async () => {
    if (flyingRef.current) return;

    const button = buttonRef.current;
    const cart = cartRef.current;

    // Tetap tambahkan produk jika elemen animasi tidak ditemukan.
    if (!button || !cart || reduceMotion) {
      onAdd();
      return;
    }

    const imageElement = button
      .closest("li")
      ?.querySelector<HTMLImageElement>(".nnorte-product-image");

    const imageUrl = imageElement?.src || product.image;

    if (!imageUrl) {
      onAdd();
      return;
    }

    flyingRef.current = true;
    setIsFlying(true);

    const startRect = (imageElement ?? button).getBoundingClientRect();
    const endRect = cart.getBoundingClientRect();

    const flyer = document.createElement("img");
    flyer.src = imageUrl;
    flyer.alt = "";
    flyer.setAttribute("aria-hidden", "true");

    Object.assign(flyer.style, {
      position: "fixed",
      left: `${startRect.left + startRect.width / 2 - 35}px`,
      top: `${startRect.top + startRect.height / 2 - 35}px`,
      width: "70px",
      height: "70px",
      objectFit: "cover",
      borderRadius: "16px",
      zIndex: "99999",
      pointerEvents: "none",
      boxShadow: "0 14px 35px rgba(0, 0, 0, 0.3)",
      willChange: "transform, opacity",
    });

    document.body.appendChild(flyer);

    const deltaX =
      endRect.left + endRect.width / 2 -
      (startRect.left + startRect.width / 2);

    const deltaY =
      endRect.top + endRect.height / 2 -
      (startRect.top + startRect.height / 2);

    try {
      // Keranjang langsung diperbarui; flyer hanya umpan balik visual.
      onAdd();

      const entryDuration = 0.72;
      const flyIn = animate(
        flyer,
        {
          x: [0, deltaX * 0.55, deltaX],
          y: [0, deltaY * 0.25 - 80, deltaY],
          scale: [1, 0.72, 0.16],
          opacity: [1, 0.9, 0],
          rotate: [0, -12, 15],
        },
        {
          duration: entryDuration,
          ease: [0.22, 0.61, 0.36, 1],
        },
      ).finished;

      // Mulai getaran tepat sebelum flyer tiba supaya puncaknya bertepatan
      // dengan produk masuk ke keranjang.
      const arrivalShake = new Promise<void>((resolve) => {
        window.setTimeout(() => {
          void shakeCart(cart).finally(resolve);
        }, entryDuration * 1000 * 0.82);
      });
      await Promise.all([flyIn, arrivalShake]);

      // Beri jeda singkat, lalu getarkan keranjang bersamaan dengan produk
      // yang keluar kembali dari keranjang.
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      const flyOut = (async () => {
        await animate(
          flyer,
          {
            x: deltaX,
            y: deltaY,
            scale: 0.16,
            rotate: 0,
            opacity: 0,
          },
          { duration: 0 },
        ).finished;

        await animate(
          flyer,
          {
            x: [deltaX, deltaX * 0.52, 0],
            y: [deltaY, deltaY * 0.25 - 70, 0],
            scale: [0.16, 0.72, 1],
            rotate: [0, 10, -6, 0],
            opacity: [0, 0.9, 1],
          },
          {
            duration: 0.56,
            ease: [0.22, 0.7, 0.25, 1],
          },
        ).finished;
      })();

      await Promise.all([flyOut, shakeCart(cart)]);
    } catch {
      // Animasi hanya dekoratif; produk sudah ditambahkan ke keranjang.
    } finally {
      flyer.remove();
      flyingRef.current = false;
      setIsFlying(false);
    }
  };

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      onClick={handleAdd}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      disabled={isFlying}
      aria-label={`Tambah ${product.name} ke keranjang`}
      className="nn-press inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-transparent bg-nnorte-red px-3 text-[11px] font-bold text-nnorte-on-brand shadow-sm hover:bg-nnorte-red-hover disabled:cursor-wait disabled:opacity-70"
    >
      {isFlying ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : (
        <Plus size={13} aria-hidden="true" />
      )}
      <span>{isFlying ? "..." : "Tambah"}</span>
    </motion.button>
  );
}
