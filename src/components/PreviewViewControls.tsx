import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FlipHorizontal2, RectangleHorizontal, RectangleVertical, Smartphone } from "lucide-react";

export type PreviewOrientation = "auto" | "landscape" | "portrait";

export interface PreviewView {
  orientation: PreviewOrientation;
  mirror: boolean;
}

const DEFAULT_VIEW: PreviewView = { orientation: "auto", mirror: true };

function read(storageKey: string): PreviewView {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return { ...DEFAULT_VIEW, ...(JSON.parse(raw) as Partial<PreviewView>) };
  } catch {
    /* sin almacenamiento */
  }
  return DEFAULT_VIEW;
}

/**
 * Estado persistente de la vista previa: orientación (auto/horizontal/vertical)
 * y modo espejo. Se guarda por clave en localStorage.
 */
export function usePreviewView(storageKey: string) {
  const [view, setView] = useState<PreviewView>(DEFAULT_VIEW);

  // Se lee tras hidratar para evitar desajustes de SSR.
  useEffect(() => {
    setView(read(storageKey));
  }, [storageKey]);

  const update = useCallback(
    (patch: Partial<PreviewView>) => {
      setView((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* opcional */
        }
        return next;
      });
    },
    [storageKey],
  );

  const frameClass =
    view.orientation === "portrait"
      ? "aspect-[9/16] mx-auto w-full max-w-[280px] sm:max-w-[320px]"
      : view.orientation === "landscape"
        ? "aspect-video"
        : // auto: vertical en móvil, horizontal en tablet/escritorio
          "aspect-[9/16] mx-auto w-full max-w-[280px] sm:mx-0 sm:max-w-none sm:aspect-video";

  const videoClass = `h-full w-full object-cover ${view.mirror ? "scale-x-[-1]" : ""}`;

  return { view, update, frameClass, videoClass };
}

/** Botonera accesible para cambiar orientación y espejo del preview. */
export function PreviewViewControls({
  view,
  onChange,
}: {
  view: PreviewView;
  onChange: (patch: Partial<PreviewView>) => void;
}) {
  const options: { value: PreviewOrientation; label: string; icon: React.ReactNode }[] = [
    { value: "auto", label: "Orientación automática", icon: <Smartphone className="h-4 w-4" /> },
    {
      value: "landscape",
      label: "Vista horizontal",
      icon: <RectangleHorizontal className="h-4 w-4" />,
    },
    { value: "portrait", label: "Vista vertical", icon: <RectangleVertical className="h-4 w-4" /> },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Orientación de la vista previa"
        className="flex items-center gap-1 rounded-md border border-border p-1"
      >
        {options.map((o) => (
          <Button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={view.orientation === o.value}
            aria-label={o.label}
            title={o.label}
            size="icon"
            variant={view.orientation === o.value ? "secondary" : "ghost"}
            className="h-8 w-8"
            onClick={() => onChange({ orientation: o.value })}
          >
            {o.icon}
          </Button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant={view.mirror ? "secondary" : "outline"}
        aria-pressed={view.mirror}
        onClick={() => onChange({ mirror: !view.mirror })}
        className="h-8 gap-2"
      >
        <FlipHorizontal2 className="h-4 w-4" />
        {view.mirror ? "Espejo activado" : "Espejo desactivado"}
      </Button>
    </div>
  );
}
