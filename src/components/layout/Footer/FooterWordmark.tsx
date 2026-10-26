import { useEffect, useRef } from "react";

const LETTERS = "NNORTE".split("");

type LetterRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Wordmark raksasa `NNORTE`.
 *
 * Pergerakan pointer ditulis langsung ke CSS custom properties lewat
 * requestAnimationFrame, jadi React tidak pernah re-render saat mouse bergerak.
 * Warna beam/glow sepenuhnya berasal dari tema aktif (`Footer` -> data-theme-mode).
 */
export function FooterWordmark() {
  const rootRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const letters = letterRefs.current.filter((node): node is HTMLSpanElement => node !== null);
    if (letters.length === 0) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rects: LetterRect[] = [];
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let targetPower = 0;
    let power = 0;
    let frame = 0;
    let touchTimer = 0;

    const measure = () => {
      const base = root.getBoundingClientRect();
      rects = letters.map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          left: rect.left - base.left,
          top: rect.top - base.top,
          width: rect.width,
          height: rect.height,
        };
      });
    };

    const render = () => {
      frame = 0;
      const positionEase = reducedMotion.matches ? 1 : 0.18;
      const powerEase = reducedMotion.matches ? 1 : 0.14;
      x += (targetX - x) * positionEase;
      y += (targetY - y) * positionEase;
      power += (targetPower - power) * powerEase;

      const settled =
        Math.abs(targetX - x) < 0.15 &&
        Math.abs(targetY - y) < 0.15 &&
        Math.abs(targetPower - power) < 0.003;

      if (settled) {
        x = targetX;
        y = targetY;
        power = targetPower;
      }

      root.style.setProperty("--mx", `${x.toFixed(2)}px`);
      root.style.setProperty("--my", `${y.toFixed(2)}px`);
      root.style.setProperty("--power", power.toFixed(4));

      // Biarkan filter glow ikut meredup bersama opacity sebelum kelas dilepas.
      if (targetPower === 0 && power < 0.004) root.classList.remove("is-lit");

      const width = root.clientWidth || 1;
      root.style.setProperty("--beam-rot", `${(-16 + (x / width - 0.5) * 10).toFixed(2)}deg`);

      letters.forEach((el, index) => {
        const rect = rects[index];
        if (!rect) return;

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height * 0.52;
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.hypot(dx, dy);
        const reach = Math.max(rect.width * 1.45, 170);
        const radial = Math.max(0, 1 - distance / reach);

        // Proyeksi jarak huruf terhadap garis diagonal (beam) yang melewati pointer.
        const beamDistance = Math.abs(dx * 0.88 - dy * 0.47);
        const beam = Math.max(0, 1 - beamDistance / 140);
        const lit = Math.min(1, Math.max(radial * 1.2, beam * 0.95)) * power;
        const lift = reducedMotion.matches ? 0 : -7.5 * lit * lit;

        el.style.setProperty("--lit", lit.toFixed(4));
        el.style.setProperty("--lift", `${lift.toFixed(2)}px`);
        el.style.setProperty("--tilt", `${(lit * -1.2).toFixed(2)}deg`);
        el.style.setProperty("--lx", `${(x - rect.left).toFixed(1)}px`);
        el.style.setProperty("--ly", `${(y - rect.top).toFixed(1)}px`);
        el.style.setProperty("--reach", `${Math.round(Math.max(rect.width * 1.8, 110))}px`);
      });

      if (!settled) frame = window.requestAnimationFrame(render);
    };

    const start = () => {
      if (frame === 0) frame = window.requestAnimationFrame(render);
    };

    const pointTo = (event: PointerEvent) => {
      const base = root.getBoundingClientRect();
      targetX = event.clientX - base.left;
      targetY = event.clientY - base.top;
    };

    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      measure();
      pointTo(event);
      targetPower = 1;
      root.classList.add("is-lit");
      start();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointTo(event);
      targetPower = 1;
      root.classList.add("is-lit");
      start();
    };

    const onPointerLeave = () => {
      targetPower = 0;
      start();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      measure();
      pointTo(event);
      targetPower = 1;
      root.classList.add("is-lit");
      start();
      window.clearTimeout(touchTimer);
      touchTimer = window.setTimeout(() => {
        targetPower = 0;
        start();
      }, 900);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("pointerdown", onPointerDown, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(touchTimer);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div className="nn-footer__wordmark" ref={rootRef} aria-hidden="true">
      <span className="nn-footer__wordmark-row">
        {LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            ref={(node) => {
              letterRefs.current[index] = node;
            }}
            className="nn-footer__letter"
          >
            <span className="nn-footer__letter-base">{letter}</span>
            <span className="nn-footer__letter-light">{letter}</span>
          </span>
        ))}
      </span>
      <span className="nn-footer__beam" />
      <span className="nn-footer__flare" />
    </div>
  );
}
