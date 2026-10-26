"use client";

import { useEffect, useRef, useState } from "react";
import { User, Lock, ArrowRight } from "lucide-react";

/**
 * Vertex shader source code
 */
const vertexSmokeySource = `
  attribute vec4 a_position;
  void main() {
    gl_Position = a_position;
  }
`;

/**
 * Fragment shader source code for the smokey background effect
 * Red and blue gradient that flows and mixes into purple
 */
const fragmentSmokeySource = `
precision mediump float;

uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color_left;
uniform vec3 u_color_right;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution;
    vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);

    float time = iTime * 0.5;

    // Normalize mouse input (0.0 - 1.0) and remap to -1.0 ~ 1.0
    vec2 mouse = iMouse / iResolution;
    vec2 rippleCenter = 2.0 * mouse - 1.0;

    vec2 distortion = centeredUV;
    // Apply distortion for a wavy, smokey effect
    for (float i = 1.0; i < 8.0; i++) {
        distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
        distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
    }

    // Create a glowing wave pattern
    float wave = abs(sin(distortion.x + distortion.y + time));
    float glow = smoothstep(0.9, 0.2, wave);

    // Blend between left (red) and right (blue) based on x position
    // With distortion for flowing effect
    float blendX = (centeredUV.x + 1.0) * 0.5 + distortion.x * 0.1;
    blendX = clamp(blendX, 0.0, 1.0);

    vec3 color = mix(u_color_left, u_color_right, blendX);
    color = color * glow + color * 0.3;

    fragColor = vec4(color, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

/**
 * Valid blur sizes supported by Tailwind CSS.
 */
type BlurSize = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/**
 * Props for the SmokeyBackground component.
 */
interface SmokeyBackgroundProps {
  backdropBlurAmount?: BlurSize;
  className?: string;
}

/**
 * A mapping from blur size names to Tailwind CSS classes.
 */
const blurClassMap: Record<BlurSize, string> = {
  none: "backdrop-blur-none",
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
  "2xl": "backdrop-blur-2xl",
  "3xl": "backdrop-blur-3xl",
};

/**
 * A React component that renders an interactive WebGL shader background
 * with flowing red and blue colors that mix into purple.
 */
export function SmokeyBackground({
  backdropBlurAmount = "sm",
  className = "",
}: SmokeyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // Left color: vibrant red #FF0040
  // Right color: electric blue #00B4FF
  const [rLeft, gLeft, bLeft] = [1.0, 0.0, 0.25];
  const [rRight, gRight, bRight] = [0.0, 0.7, 1.0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {
      console.error("WebGL not supported");
      return;
    }

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSmokeySource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSmokeySource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const iMouseLocation = gl.getUniformLocation(program, "iMouse");
    const uColorLeftLocation = gl.getUniformLocation(program, "u_color_left");
    const uColorRightLocation = gl.getUniformLocation(program, "u_color_right");

    let startTime = Date.now();
    gl.uniform3f(uColorLeftLocation, rLeft, gLeft, bLeft);
    gl.uniform3f(uColorRightLocation, rRight, gRight, bRight);

    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      const currentTime = (Date.now() - startTime) / 1000;

      gl.uniform2f(iResolutionLocation, width, height);
      gl.uniform1f(iTimeLocation, currentTime);
      gl.uniform2f(iMouseLocation, isHovering ? mousePosition.x : width / 2, isHovering ? height - mousePosition.y : height / 2);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      setMousePosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    render();

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isHovering, mousePosition]);

  const finalBlurClass = blurClassMap[backdropBlurAmount] || blurClassMap["sm"];

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className={`absolute inset-0 ${finalBlurClass}`}></div>
    </div>
  );
}

/**
 * Props for the LoginForm component.
 */
interface LoginFormProps {
  theme: 'dark' | 'light';
  onSubmit: (email: string, password: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (remember: boolean) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  errorMessage: string;
  setErrorMessage: (message: string) => void;
  onForgotPassword: () => void;
}

/**
 * A glassmorphism-style login form component that adapts to light/dark theme.
 */
export function LoginForm({
  theme,
  onSubmit,
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  rememberMe,
  setRememberMe,
  isLoading,
  setIsLoading,
  errorMessage,
  setErrorMessage,
  onForgotPassword,
}: LoginFormProps) {
  const isDark = theme === 'dark';

  // Theme-adaptive colors
  const bgColor = isDark ? 'bg-nnorte-surface/90' : 'bg-white/80';
  const borderColor = isDark ? 'border-nnorte-border' : 'border-gray-200/50';
  const textColor = isDark ? 'text-nnorte-text' : 'text-gray-900';
  const textMuted = isDark ? 'text-nnorte-muted' : 'text-gray-500';
  const inputBg = isDark ? 'bg-nnorte-surface-2' : 'bg-white/60';
  const inputBorder = isDark ? 'border-nnorte-border' : 'border-gray-300';
  const inputText = isDark ? 'text-nnorte-text' : 'text-gray-900';
  const placeholderColor = isDark ? 'placeholder-nnorte-subtle' : 'placeholder-gray-400';
  const labelColor = isDark ? 'text-nnorte-muted' : 'text-gray-600';
  const iconColor = isDark ? 'text-nnorte-subtle' : 'text-gray-400';

  return (
    <div className="w-full max-w-md p-8 space-y-6 relative z-10">
      {/* Brand Logo & Header */}
      <div className="text-center mb-8">
        <img
          src="/nnorte-logo.svg"
          alt="Logo NNORTE Coffee & Hangout"
          className="mx-auto mb-4 h-44 w-44 rounded-full object-cover shadow-xl"
        />
        <h2 className={`text-xl font-bold leading-tight tracking-tight ${textColor}`}>
          Masuk ke NNORTE
        </h2>
        <p className={`text-sm ${textMuted} mt-1.5 leading-relaxed`}>
          Sistem Manajemen Operasional &amp; Penjualan
        </p>
      </div>

      {/* Card */}
      <div className={`${bgColor} ${borderColor} rounded-2xl p-7 shadow-2xl backdrop-blur-md`}>
        {errorMessage && (
          <div className="mb-5 p-3 rounded-lg bg-nnorte-error/10 border border-nnorte-error/30 flex items-start gap-2.5 text-xs text-nnorte-error">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(email, password);
          }}
          className="space-y-4"
        >
          {/* Email Input with Animated Label */}
          <div className="relative z-0">
            <label className={`block text-xs font-medium ${labelColor} mb-1.5`}>Email Pengguna</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-nnorte-subtle">
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@nnorte.com"
                className={`w-full pl-10 pr-4 py-2.5 ${inputBg} ${inputBorder} rounded-xl ${inputText} ${placeholderColor} focus:outline-none focus:border-nnorte-blue focus:ring-1 focus:ring-nnorte-blue transition-all`}
                required
              />
            </div>
          </div>

          {/* Password Input with Animated Label */}
          <div className="relative z-0">
            <div className="flex items-center justify-between mb-1.5">
              <label className={`block text-xs font-medium ${labelColor}`}>Kata Sandi</label>
              <a
                href="#reset"
                onClick={(e) => { e.preventDefault(); onForgotPassword(); }}
                className="text-[11px] text-nnorte-red hover:underline"
              >
                Lupa sandi?
              </a>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-nnorte-subtle">
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full pl-10 pr-10 py-2.5 ${inputBg} ${inputBorder} rounded-xl ${inputText} ${placeholderColor} focus:outline-none focus:border-nnorte-blue focus:ring-1 focus:ring-nnorte-blue transition-all`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-nnorte-subtle hover:text-nnorte-text cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-nnorte-surface-2 border-nnorte-border text-nnorte-red focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span>Ingat saya di perangkat ini</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-nnorte-red hover:bg-nnorte-red-hover text-white font-semibold text-xs rounded-xl shadow-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Memverifikasi akun...</span>
            ) : (
              <>
                <span>Masuk ke Sistem</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[11px] text-gray-500">
          NNORTE · Sistem Operasional Restoran
        </div>
      </div>
    </div>
  );
}

// Re-export icons used by LoginForm
import { Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
