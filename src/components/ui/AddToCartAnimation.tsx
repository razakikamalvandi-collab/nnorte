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

  const pulseCart = async (cart: HTMLElement) => {
    const ripple = cart.querySelector<HTMLElement>(".nnorte-cart-ripple");

    await Promise.all([
      animate(
        cart,
        { scale: [1, 1.18, 0.94, 1], rotate: [0, -5, 4, 0] },
        { duration: 0.45, ease: "easeOut" },
      ).finished,
      ripple
        ? animate(
            ripple,
            { scale: [0.4, 1.8], opacity: [0.7, 0] },
            { duration: 0.5, ease: "easeOut" },
          ).finished
        : Promise.resolve(),
    ]);

    // Bersihkan transform inline agar umpan balik tekan tombol tetap bekerja.
    cart.style.removeProperty("transform");
    cart.style.removeProperty("rotate");
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

      await animate(
        flyer,
        {
          x: [0, deltaX * 0.55, deltaX],
          y: [0, deltaY * 0.25 - 80, deltaY],
          scale: [1, 0.72, 0.16],
          opacity: [1, 0.9, 0],
          rotate: [0, -12, 15],
        },
        {
          duration: 0.72,
          ease: [0.22, 0.61, 0.36, 1],
        },
      ).finished;

      await pulseCart(cart);
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
