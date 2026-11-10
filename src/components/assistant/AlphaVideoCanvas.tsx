import { useEffect, useRef, useState } from "react";

export type AlphaSource =
  | { kind: "video"; el: HTMLVideoElement | null }
  | { kind: "sprite"; cell: number }
  | null;

type Sprite = { src: string; cols: number; rows: number };

/**
 * Pinta con transparencia un vídeo «apilado»: la mitad de arriba es la imagen y
 * la de abajo la máscara (blanco = visible). Funciona en todos los navegadores,
 * incluido Safari, porque usa un MP4 normal y WebGL para recortar el fondo.
 * También puede pintar una celda de una hoja de imágenes con el mismo formato
 * (las posiciones de boca que siguen a la voz).
 */
export function AlphaVideoCanvas({
  getSource,
  sprite,
  fallbackSrc,
  className,
  width = 480,
  height = 382,
}: {
  getSource: () => AlphaSource;
  sprite?: Sprite;
  fallbackSrc: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const getRef = useRef(getSource);
  getRef.current = getSource;
  const spriteSrc = sprite?.src;
  const cols = sprite?.cols ?? 1;
  const rows = sprite?.rows ?? 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }`;
    const fs = `precision mediump float; varying vec2 uv; uniform sampler2D t; uniform vec2 off; uniform vec2 sc;
      void main(){ vec3 c = texture2D(t, off + vec2(uv.x, uv.y*0.5)*sc).rgb; float a = texture2D(t, off + vec2(uv.x, 0.5+uv.y*0.5)*sc).r; gl_FragColor = vec4(c, a); }`;
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
    const uOff = gl.getUniformLocation(prog, "off");
    const uSc = gl.getUniformLocation(prog, "sc");

    const makeTex = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    };
    const videoTex = makeTex();
    const spriteTex = spriteSrc ? makeTex() : null;
    let spriteReady = false;
    let disposed = false;
    if (spriteSrc && spriteTex) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        try {
          gl.bindTexture(gl.TEXTURE_2D, spriteTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
          spriteReady = true;
        } catch {
          /* sin hoja: se seguirá viendo el vídeo */
        }
      };
      img.src = spriteSrc;
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let raf = 0;
    let lastKey = "";
    let drawn = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const src = getRef.current();
      if (!src) return;
      try {
        if (src.kind === "sprite") {
          if (!spriteReady || !spriteTex) return;
          const key = `s${src.cell}`;
          if (key === lastKey) return;
          lastKey = key;
          const col = src.cell % cols;
          const row = Math.floor(src.cell / cols);
          gl.bindTexture(gl.TEXTURE_2D, spriteTex);
          gl.uniform2f(uOff, col / cols, row / rows);
          gl.uniform2f(uSc, 1 / cols, 1 / rows);
        } else {
          const v = src.el;
          if (!v || v.readyState < 2) return;
          const key = `v${v.currentSrc}|${v.currentTime}`;
          if (key === lastKey) return;
          lastKey = key;
          gl.bindTexture(gl.TEXTURE_2D, videoTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
          gl.uniform2f(uOff, 0, 0);
          gl.uniform2f(uSc, 1, 1);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!drawn) {
          drawn = true;
          canvas.dataset.ready = "1";
        }
        canvas.dataset.source = src.kind;
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
