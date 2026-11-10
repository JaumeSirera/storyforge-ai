import { useEffect, useRef, useState } from "react";

/**
 * Pinta con transparencia un vídeo «apilado»: la mitad de arriba es la imagen y
 * la de abajo la máscara (blanco = visible). Funciona en todos los navegadores,
 * incluido Safari, porque usa un MP4 normal y WebGL para recortar el fondo.
 */
export function AlphaVideoCanvas({
  getVideo,
  fallbackSrc,
  className,
  width = 480,
  height = 382,
}: {
  getVideo: () => HTMLVideoElement | null;
  fallbackSrc: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const getRef = useRef(getVideo);
  getRef.current = getVideo;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }
    const vs = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }`;
    const fs = `precision mediump float; varying vec2 uv; uniform sampler2D t;
      void main(){ vec3 c = texture2D(t, vec2(uv.x, uv.y*0.5)).rgb; float a = texture2D(t, vec2(uv.x, 0.5+uv.y*0.5)).r; gl_FragColor = vec4(c, a); }`;
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
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    let raf = 0;
    let last: HTMLVideoElement | null = null;
    let lastTime = -1;
    let drawn = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = getRef.current();
      if (!v || v.readyState < 2) return;
      if (v === last && v.currentTime === lastTime) return;
      last = v;
      lastTime = v.currentTime;
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, v);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (!drawn) {
          drawn = true;
          canvas.dataset.ready = "1";
        }
      } catch {
        cancelAnimationFrame(raf);
        setFailed(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (failed) {
    return <img src={fallbackSrc} alt="" draggable={false} className={className} />;
  }
  return <canvas ref={canvasRef} width={width} height={height} className={className} aria-hidden />;
}
