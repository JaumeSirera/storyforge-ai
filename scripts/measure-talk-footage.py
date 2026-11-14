#!/usr/bin/env python3
"""Mide cuánto abre la boca la asistente en cada fotograma de
public/assistant/hablando-alfa.mp4 y reescribe src/lib/assistant-talk-footage.ts.

Se mide en la imagen (no con el sonido): en la zona de la boca se cuentan, por
columna, las filas del interior oscuro de la boca y, con menos peso, las de los
dientes; se toma la media de las columnas centrales. Hay que volver a lanzarlo
si cambia ese vídeo o su encuadre.  Uso: python3 scripts/measure-talk-footage.py
"""
import subprocess
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "public/assistant/hablando-alfa.mp4"
OUT = ROOT / "src/lib/assistant-talk-footage.ts"
CROP_W, CROP_H, CROP_X, CROP_Y = 120, 90, 180, 170  # zona de la boca en la mitad de color
FPS_VIDEO, FPS_OUT = 24, 50

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", str(VIDEO), "-vf", f"crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y}",
     "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
    capture_output=True, check=True,
).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, CROP_H, CROP_W, 3)
a = frames[:, 28:72, 46:78].astype(float)
lum = a.mean(-1)
mx, mn = a.max(-1), a.min(-1)
med = np.median(lum.reshape(len(a), -1), axis=1)[:, None, None]
teeth = (mn > 135) & ((mx - mn) < 55)
dark = (lum < 0.68 * med) & ~teeth
per_col = dark.sum(1) + 0.45 * teeth.sum(1)
q = per_col.shape[1] // 4
opening = np.sort(per_col, axis=1)[:, q:3 * q].mean(1)
opening = np.clip(opening / np.percentile(opening, 95), 0, 1)

n_frames = len(frames)
n_out = round(n_frames / FPS_VIDEO * FPS_OUT)
values = [round(float(opening[min(n_frames - 1, int(i / FPS_OUT * FPS_VIDEO))]), 2) for i in range(n_out)]
rows = [", ".join(f"{v:g}" for v in values[i:i + 25]) for i in range(0, len(values), 25)]
OUT.write_text(
    "/**\n"
    " * Cuánto abre la boca (0–1) la grabación de su cara hablando\n"
    " * (public/assistant/hablando-alfa.mp4, 50 valores por segundo), medido en la\n"
    " * propia imagen de cada fotograma con scripts/measure-talk-footage.py. Sirve\n"
    " * para elegir en cada momento el trozo de la grabación cuya boca coincide con\n"
    " * la voz de la respuesta. Si se cambia ese vídeo hay que volver a medirlo.\n"
    " */\n"
    f"export const TALK_LOOP_SECONDS = {n_frames} / {FPS_VIDEO};\n"
    "export const TALK_FOOTAGE: readonly number[] = [\n"
    + "".join(f"  {r},\n" for r in rows)
    + "];\n"
)
print(f"{n_frames} fotogramas -> {len(values)} valores en {OUT.relative_to(ROOT)}")
