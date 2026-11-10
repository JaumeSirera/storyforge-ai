import { useEffect, useRef, useState } from "react";
import { MOUTH_SHAPE, createOpenSmoother } from "@/lib/assistant-lipsync";

/**
 * Lo que debe verse en cada instante:
 * - `idle`: bucle tranquilo de espera (siempre debajo).
 * - `greet`: vídeo del saludo; se funde encima mientras `greeting` es true.
 * - `mouthOpen`: mientras habla, cuánto abre la boca (0–1). La boca se deforma
 *   en directo sobre la propia cara del bucle de espera: no se pega ninguna
 *   imagen encima, así no hay sombras ni cambia de tamaño.
 */
export type AvatarFrame = {
  idle: HTMLVideoElement | null;
  greet: HTMLVideoElement | null;
  greeting: boolean;
  mouthOpen: number | null;
};

/** Tiempos de fundido (ms). */
const FADE = { greetIn: 160, greetOut: 420 };

/**
 * Pinta con transparencia vídeos «apilados»: la mitad de arriba es la imagen y
 * la de abajo la máscara (blanco = visible). Funciona en todos los navegadores,
 * incluido Safari, porque usa un MP4 normal y WebGL para recortar el fondo.
 */
export function AlphaVideoCanvas({
  getFrame,
  fallbackSrc,
  className,
  width = 480,
  height = 382,
}: {
  getFrame: () => AvatarFrame;
  fallbackSrc: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const getRef = useRef(getFrame);
  getRef.current = getFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const [sa, sb, sc] = MOUTH_SHAPE.seam;
    const f = (n: number) => n.toFixed(8);
    const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }`;
    const fs = `precision highp float; varying vec2 uv;
      uniform sampler2D tIdle; uniform sampler2D tGreet;
      uniform float wGreet; uniform float open;
      const vec2 SZ = vec2(${f(width)}, ${f(height)});
      float sst(float a, float b, float x){ float t = clamp((x-a)/(b-a), 0.0, 1.0); return t*t*(3.0-2.0*t); }
      void main(){
        vec2 px = uv * SZ;
        float ys = px.y;
        float m = 0.0; float k = 0.0; float tz = 0.0;
        if (open > 0.0) {
          float seam = ${f(sa)}*px.x*px.x + ${f(sb)}*px.x + ${f(sc)};
          float q = clamp(1.0 - pow((px.x-${f(MOUTH_SHAPE.centerX)})/${f(MOUTH_SHAPE.halfWidth)}, 2.0), 0.0, 1.0);
          // Perfil más cerrado hacia las comisuras: la boca encoge al abrirse.
          float pl = pow(q, 1.05);
          float d = open*pl; float u = 0.45*open*pl;
          float below = px.y - seam;
          if (below >= 0.0) ys = px.y - d*(1.0 - sst(12.0, 44.0, below));
          else ys = px.y + u*(1.0 - sst(0.0, 14.0, -below));
          // Margen extra: tapa la línea oscura original entre los labios (si no, deja una sombra punteada).
          float e = 1.1*clamp(open/1.5, 0.0, 1.0)*pl;
          float top = seam - u - 0.6*e; float bot = seam + d + e;
          float gap = max(bot-top, 0.001);
          float t = clamp((px.y-top)/gap, 0.0, 1.0);
          m = sst(-0.9, 0.9, px.y-top) * (1.0 - sst(-0.9, 0.9, px.y-bot)) * sst(0.0, 0.2, q);
          k = sin(3.14159*t) * clamp((gap-1.5)/5.0, 0.0, 1.0) * sst(0.0, 0.5, q);
          tz = sst(0.0, 0.1, t) * (1.0 - sst(0.2, 0.45, t)) * sst(4.5, 7.5, gap) * sst(0.3, 0.7, q);
        }
        vec2 top2 = vec2(uv.x, (ys/SZ.y)*0.5); vec2 bot2 = vec2(uv.x, 0.5+uv.y*0.5);
        vec3 c = texture2D(tIdle, top2).rgb; float a = texture2D(tIdle, bot2).r;
        vec3 inside = mix(vec3(0.50,0.28,0.28), vec3(0.24,0.10,0.11), k);
        inside = mix(inside, vec3(0.78,0.68,0.64), 0.6*tz);
        c = mix(c, inside, m);
        if (wGreet > 0.0) {
          c = mix(c, texture2D(tGreet, vec2(uv.x, uv.y*0.5)).rgb, wGreet);
          a = mix(a, texture2D(tGreet, bot2).r, wGreet);
        }
        gl_FragColor = vec4(c, a);
      }`;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uGreet = u("wGreet");
    const uOpen = u("open");

    const makeTex = (unit: number, name: string) => {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
      gl.uniform1i(u(name), unit);
      return tex;
    };
    const texIdle = makeTex(0, "tIdle");
    const texGreet = makeTex(1, "tGreet");
    const upload = (unit: number, tex: WebGLTexture | null, src: TexImageSource) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    };

    const smoothOpen = createOpenSmoother();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const approach = (v: number, target: number, dt: number, inMs: number, outMs: number) =>
      target > v ? Math.min(target, v + dt / inMs) : Math.max(target, v - dt / outMs);
    const ease = (t: number) => t * t * (3 - 2 * t);

    let raf = 0;
    let last = performance.now();
    let idleKey = "";
    let greetKey = "";
    let wGreet = 0;
    let open = 0;
    let drawnKey = "";
    let drawn = false;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(100, now - last);
      last = now;
      const f = getRef.current();
      const idle = f.idle;
      if (!idle || idle.readyState < 2) return;
      try {
        const greetOk = !!f.greet && f.greet.readyState >= 2;
        wGreet = approach(wGreet, f.greeting && greetOk ? 1 : 0, dt, FADE.greetIn, FADE.greetOut);
        open = smoothOpen(f.mouthOpen ?? 0, now);
        const openPx = open * MOUTH_SHAPE.maxOpenPx;

        const ik = `${idle.currentSrc}|${idle.currentTime}`;
        if (ik !== idleKey) {
          idleKey = ik;
          upload(0, texIdle, idle);
        }
        if (wGreet > 0 && f.greet && greetOk) {
          const gk = `${f.greet.currentSrc}|${f.greet.currentTime}`;
          if (gk !== greetKey) {
            greetKey = gk;
            upload(1, texGreet, f.greet);
          }
        }
        const key = `${idleKey}|${greetKey}|${wGreet.toFixed(3)}|${openPx.toFixed(2)}`;
        if (key === drawnKey) return;
        drawnKey = key;
        gl.uniform1f(uOpen, openPx);
        gl.uniform1f(uGreet, ease(wGreet));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!drawn) {
          drawn = true;
          canvas.dataset.ready = "1";
        }
        canvas.dataset.source = wGreet > 0.5 ? "greeting" : f.mouthOpen !== null ? "talking" : "idle";
      } catch {
        cancelAnimationFrame(raf);
        setFailed(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [width, height]);

  if (failed) {
    return <img src={fallbackSrc} alt="" draggable={false} className={className} />;
  }
  return <canvas ref={canvasRef} width={width} height={height} className={className} aria-hidden />;
}
