import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, UserX } from "lucide-react";

/**
 * Foto de identidad antes del examen. Devuelve un JPEG pequeño (320 px) en base64
 * o `declined` si el aspirante no da permiso o no tiene cámara.
 */
export function ExamIdentityPhoto({
  value,
  declined,
  onChange,
}: {
  value: string | null;
  declined: boolean;
  onChange: (v: { photo: string | null; declined: boolean }) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };
  useEffect(() => stop, []);

  const openCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("No se ha podido abrir la cámara. Puedes darle permiso en el navegador o continuar sin foto.");
    }
  };

  const take = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const w = 320;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(v, 0, 0, w, h);
    onChange({ photo: canvas.toDataURL("image/jpeg", 0.6), declined: false });
    stop();
  };

  return (
    <div className="space-y-3 rounded-md border border-border p-3 text-sm">
      <p className="font-medium">Foto de identidad</p>
      <p className="text-muted-foreground">
        Para comprobar quién hace el examen, se toma una foto con la cámara al empezar. Solo la verá
        la persona que te evalúa. Puedes negarte; quedará anotado.
      </p>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt="Tu foto de identidad" className="h-20 w-28 rounded-md border border-border object-cover" />
          <Button type="button" variant="outline" size="sm" onClick={() => { onChange({ photo: null, declined: false }); void openCamera(); }}>
            <RotateCcw className="h-4 w-4" /> Repetir
          </Button>
        </div>
      ) : declined ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground">Continuarás sin foto.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => { onChange({ photo: null, declined: false }); void openCamera(); }}>
            <Camera className="h-4 w-4" /> Hacer la foto
          </Button>
        </div>
      ) : live ? (
        <div className="space-y-2">
          <video ref={videoRef} muted playsInline className="w-full max-w-xs rounded-md border border-border" />
          <Button type="button" size="sm" onClick={take}><Camera className="h-4 w-4" /> Hacer foto</Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openCamera}><Camera className="h-4 w-4" /> Activar cámara</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ photo: null, declined: true })}>
            <UserX className="h-4 w-4" /> Continuar sin foto
          </Button>
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
