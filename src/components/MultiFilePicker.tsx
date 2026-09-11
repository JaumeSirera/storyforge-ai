import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, FolderOpen, Scan, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxBytes?: number;
  accept?: string;
  disabled?: boolean;
};

function sameFile(a: File, b: File) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function humanSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MultiFilePicker({
  files,
  onChange,
  maxFiles = 12,
  maxBytes = 15 * 1024 * 1024,
  accept = "image/*,application/pdf",
  disabled,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [camReady, setCamReady] = useState(false);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }

  useEffect(() => () => stopCam(), []);

  async function openCamera() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      cameraRef.current?.click();
      return;
    }
    setCamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamReady(true);
    } catch {
      setCamOpen(false);
      toast.error("No se pudo abrir la cámara. Se abrirá el selector de archivos.");
      cameraRef.current?.click();
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );
    if (!blob) {
      toast.error("No se pudo capturar la foto");
      return;
    }
    const file = new File([blob], `foto-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    const dt = new DataTransfer();
    dt.items.add(file);
    add(dt.files);
    toast.success("Foto añadida");
  }


  function add(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const next = [...files];
    let skippedBig = 0;
    let skippedDup = 0;
    let skippedMax = 0;
    for (const file of Array.from(selected)) {
      if (file.size === 0) continue;
      if (file.size > maxBytes) {
        skippedBig++;
        continue;
      }
      if (next.some((f) => sameFile(f, file))) {
        skippedDup++;
        continue;
      }
      if (next.length >= maxFiles) {
        skippedMax++;
        continue;
      }
      next.push(file);
    }
    onChange(next);
    if (skippedBig) toast.error(`${skippedBig} archivo(s) superan ${humanSize(maxBytes)}`);
    if (skippedDup) toast.info(`${skippedDup} archivo(s) ya estaban añadidos`);
    if (skippedMax) toast.error(`Máximo ${maxFiles} archivos`);
  }

  return (
    <div className="space-y-3">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
          className="gap-2"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Hacer foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => filesRef.current?.click()}
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          Elegir del dispositivo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => filesRef.current?.click()}
          className="gap-2"
        >
          <Scan className="h-4 w-4" aria-hidden="true" />
          Escáner (varios archivos)
        </Button>
        {files.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange([])}
            className="gap-2 text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Quitar todo
          </Button>
        )}
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Puedes añadir varias veces: fotos con la cámara, imágenes del ordenador o los PDF del
          escáner. Máximo {maxFiles} archivos de {humanSize(maxBytes)} cada uno.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
            >
              <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {humanSize(file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Quitar ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
