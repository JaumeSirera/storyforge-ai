import { useEffect, useRef, useState } from "react";

/**
 * Lo que debe verse en cada instante:
 * - `idle`: bucle tranquilo de espera (siempre debajo).
 * - `greet`: vídeo del saludo; se funde encima mientras `greeting` es true.
 * - `mouthCell`: mientras habla, celda de la hoja de bocas que se pega solo en
 *   la zona de la boca sobre el bucle de espera (la cabeza no salta).
 */
export type AvatarFrame = {
  idle: HTMLVideoElement | null;
  greet: HTMLVideoElement | null;
  greeting: boolean;
  mouthCell: number | null;
};

type Sprite = { src: string; cols: number; rows: number };

/** Tiempos de fundido (ms). */
const FADE = { greetIn: 160, greetOut: 420, mouthIn: 110, mouthOut: 180, cell: 70 };

/**
 * Pinta con transparencia vídeos «apilados»: la mitad de arriba es la imagen y
 * la de abajo la máscara (blanco = visible). Funciona en todos los navegadores,
 * incluido Safari, porque usa un MP4 normal y WebGL para recortar el fondo.
 * La hoja de bocas usa el mismo formato, pero su mitad de abajo indica cuánto
 * de la boca se mezcla con la cara (borde suave).
 */
export function AlphaVideoCanvas({
  getFrame,
  sprite,
  fallbackSrc,
  className,
  width = 480,
  height = 382,
}: {
  getFrame: () => AvatarFrame;
  sprite: Sprite;
  fallbackSrc: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const getRef = useRef(getFrame);
  getRef.current = getFrame;
  const { src: spriteSrc, cols, rows } = sprite;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }`;
    const fs = `precision mediump float; varying vec2 uv;
      uniform sampler2D tIdle; uniform sampler2D tGreet; uniform sampler2D tMouth;
      uniform float wGreet; uniform float wMouth; uniform float wCell;
      uniform vec2 offA; uniform vec2 offB; uniform vec2 sc;
      void main(){
        vec2 top = vec2(uv.x, uv.y*0.5); vec2 bot = vec2(uv.x, 0.5+uv.y*0.5);
        vec3 c = texture2D(tIdle, top).rgb; float a = texture2D(tIdle, bot).r;
        if (wMouth > 0.0) {
          vec3 mA = texture2D(tMouth, offA + top*sc).rgb; float kA = texture2D(tMouth, offA + bot*sc).r;
          vec3 mB = texture2D(tMouth, offB + top*sc).rgb; float kB = texture2D(tMouth, offB + bot*sc).r;
          vec3 m = mix(mA, mB, wCell); float k = mix(kA, kB, wCell);
          c = mix(c, m, k*wMouth);
        }
        if (wGreet > 0.0) {
          c = mix(c, texture2D(tGreet, top).rgb, wGreet);
          a = mix(a, texture2D(tGreet, bot).r, wGreet);
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
    const uMouth = u("wMouth");
    const uCell = u("wCell");
    const uOffA = u("offA");
    const uOffB = u("offB");
    gl.uniform2f(u("sc"), 1 / cols, 1 / rows);

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
    const texMouth = makeTex(2, "tMouth");
    const upload = (unit: number, tex: WebGLTexture | null, src: TexImageSource) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    };

    let mouthReady = false;
    let disposed = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (disposed) return;
      try {
        upload(2, texMouth, img);
        mouthReady = true;
      } catch {
        /* sin hoja de bocas: habla con el bucle de espera */
      }
    };
    img.src = spriteSrc;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const cellOff = (cell: number) => [(cell % cols) / cols, Math.floor(cell / cols) / rows] as const;
    const approach = (v: number, target: number, dt: number, inMs: number, outMs: number) =>
      target > v ? Math.min(target, v + dt / inMs) : Math.max(target, v - dt / outMs);
    const ease = (t: number) => t * t * (3 - 2 * t);

    let raf = 0;
    let last = performance.now();
    let idleKey = "";
    let greetKey = "";
    let wGreet = 0;
    let wMouth = 0;
    let cellA = 0;
    let cellB = 0;
    let cellT = 1;
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
        const talking = f.mouthCell !== null && mouthReady;
        wMouth = approach(wMouth, talking ? 1 : 0, dt, FADE.mouthIn, FADE.mouthOut);
        if (talking && f.mouthCell !== cellB) {
          // Funde la boca anterior con la nueva para que no dé saltos.
          cellA = cellT >= 0.5 ? cellB : cellA;
          cellB = f.mouthCell as number;
          cellT = 0;
        }
        cellT = Math.min(1, cellT + dt / FADE.cell);

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
        const key = `${idleKey}|${greetKey}|${wGreet.toFixed(3)}|${wMouth.toFixed(3)}|${cellA}|${cellB}|${cellT.toFixed(3)}`;
        if (key === drawnKey) return;
        drawnKey = key;
        const [ax, ay] = cellOff(cellA);
        const [bx, by] = cellOff(cellB);
        gl.uniform2f(uOffA, ax, ay);
        gl.uniform2f(uOffB, bx, by);
        gl.uniform1f(uCell, ease(cellT));
        gl.uniform1f(uMouth, ease(wMouth));
        gl.uniform1f(uGreet, ease(wGreet));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!drawn) {
          drawn = true;
          canvas.dataset.ready = "1";
        }
        canvas.dataset.source = wGreet > 0.5 ? "greeting" : wMouth > 0.5 ? "talking" : "idle";
      } catch {
        cancelAnimationFrame(raf);
        setFailed(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [spriteSrc, cols, rows]);

  if (failed) {
    return <img src={fallbackSrc} alt="" draggable={false} className={className} />;
  }
  return <canvas ref={canvasRef} width={width} height={height} className={className} aria-hidden />;
}
