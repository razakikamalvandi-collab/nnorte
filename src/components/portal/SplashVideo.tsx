import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  /** Mis. "/splash.mp4" (file di folder public/). Format: MP4 H.264 + AAC. */
  src: string;
  /** Foto cadangan. Dipakai sebagai poster video dan bila video gagal. Tidak pernah menutupi video yang sedang jalan. */
  poster?: string;
  onDone: () => void;
  /** Kunci sessionStorage agar splash hanya sekali per sesi. Kosongkan untuk selalu tampil. */
  storageKey?: string;
  /** Batas tunggu video mulai berjalan sebelum pakai foto cadangan. */
  startTimeoutMs?: number;
  /** Lama foto cadangan ditampilkan sebelum masuk. */
  fallbackHoldMs?: number;
}

type Mode = "loading" | "playing" | "blocked" | "fallback";

export default function SplashVideo({
  src, poster, onDone, storageKey, startTimeoutMs = 4000, fallbackHoldMs = 2200,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const [mode, setMode] = useState<Mode>("loading");

  const finish = useCallback(() => {
    if (doneRef.current) return; // mencegah onDone terpanggil dua kali
    doneRef.current = true;
    if (storageKey) { try { sessionStorage.setItem(storageKey, "1"); } catch { /* mode privat */ } }
    onDone();
  }, [onDone, storageKey]);

  // Sudah pernah tampil di sesi ini → langsung lanjut.
  useEffect(() => {
    if (!storageKey) return;
    let seen = false;
    try { seen = sessionStorage.getItem(storageKey) === "1"; } catch { /* abaikan */ }
    if (seen) finish();
  }, [storageKey, finish]);

  // Hormati "kurangi animasi": tampilkan foto sebentar saja.
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("fallback");
    }
  }, []);

  // Coba putar. Autoplay hanya diizinkan browser bila muted + playsInline.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || mode === "fallback") return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    const p = v.play();
    if (p && typeof p.catch === "function") {
      p.catch((err: unknown) => {
        // NotAllowedError = autoplay diblokir (mis. mode hemat daya). Minta ketukan.
        if ((err as { name?: string })?.name === "NotAllowedError") setMode("blocked");
        else setMode("fallback");
      });
    }
    // Watchdog: bila tidak mulai berjalan, jangan biarkan layar macet.
    const t = window.setTimeout(() => {
      if (videoRef.current && videoRef.current.currentTime === 0 && videoRef.current.paused) {
        setMode((m) => (m === "playing" ? m : m === "blocked" ? m : "fallback"));
      }
    }, startTimeoutMs);
    return () => { window.clearTimeout(t); v.pause(); };
  }, [mode === "fallback", startTimeoutMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foto cadangan: tahan sebentar lalu masuk.
  useEffect(() => {
    if (mode !== "fallback") return;
    const t = window.setTimeout(finish, fallbackHoldMs);
    return () => window.clearTimeout(t);
  }, [mode, finish, fallbackHoldMs]);

  // Jaring pengaman terakhir (video terlalu panjang / macet).
  useEffect(() => {
    const t = window.setTimeout(finish, 15000);
    return () => window.clearTimeout(t);
  }, [finish]);

  const tapToPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().then(() => setMode("playing")).catch(() => setMode("fallback"));
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-black" role="presentation">
      {mode !== "fallback" && (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={src}
          poster={poster}
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setMode("playing")}
          onEnded={finish}
          onError={() => setMode("fallback")}
          onStalled={() => { /* watchdog yang menentukan */ }}
        />
      )}

      {/* Foto hanya muncul bila video gagal. Ia menggantikan video, bukan menimpanya. */}
      {mode === "fallback" && poster && (
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}

      {mode === "blocked" && (
        <button
          type="button"
          onClick={tapToPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
        >
          <span className="rounded-full border border-white/60 px-6 py-3 text-sm font-semibold">Ketuk untuk memutar</span>
        </button>
      )}

      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white"
        style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      >
        Lewati
      </button>
    </div>
  );
}
