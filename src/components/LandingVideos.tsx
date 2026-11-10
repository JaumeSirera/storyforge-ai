import { Link } from "@tanstack/react-router";
import { ArrowRight, GripVertical, MessageCircle, Mic, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectorLinks } from "@/components/SectorLanding";

/** Short vertical clips served as static files from public/demo (root-relative so they work on any hosting). */
export const landingVideos = {
  lanzamiento: { src: "/demo/xandralyze-lanzamiento.mp4", poster: "/demo/xandralyze-lanzamiento.jpg", title: "Vídeo de lanzamiento de Xandralyze", duration: "24 s" },
  educacion: { src: "/demo/xandralyze-educacion.mp4", poster: "/demo/xandralyze-educacion.jpg", title: "Xandralyze para educación", duration: "24 s" },
  seleccion: { src: "/demo/xandralyze-seleccion.mp4", poster: "/demo/xandralyze-seleccion.jpg", title: "Xandralyze para selección de personal", duration: "21 s" },
  psicologia: { src: "/demo/xandralyze-psicologia.mp4", poster: "/demo/xandralyze-psicologia.jpg", title: "Xandralyze para psicología", duration: "18 s" },
  asistente: { src: "/demo/xandralyze-asistente.mp4", poster: "/demo/xandralyze-asistente.jpg", title: "La asistente personal de Xandralyze", duration: "21 s" },
} as const;

export type LandingVideo = (typeof landingVideos)[keyof typeof landingVideos];

export function ClipVideo({ video, className = "" }: { video: LandingVideo; className?: string }) {
  return (
    <video controls playsInline preload="none" poster={video.poster} className={`rounded-lg bg-muted object-cover ${className}`} aria-label={video.title}>
      <source src={video.src} type="video/mp4" />
      <a href={video.src}>Ver el vídeo: {video.title}</a>
    </video>
  );
}

const sectorBlurb: Record<string, string> = {
  "/educacion": "Manuscritos, universidades y oposiciones",
  "/seleccion": "Assessment centers y selección gamificada",
  "/psicologia": "Sesiones e interacciones de voz",
};

/** Homepage strip: one card per sector with its own short video. */
export function SectorVideoCards() {
  return (
    <section className="border-y border-border" aria-label="Xandralyze por sector">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-3">
        {sectorLinks.map((sector) => {
          const video = landingVideos[sector.to.slice(1) as "educacion" | "seleccion" | "psicologia"];
          return (
            <article key={sector.to} className="flex flex-col gap-4">
              <ClipVideo video={video} className="mx-auto aspect-[9/16] w-full max-w-xs" />
              <Link to={sector.to} className="group flex items-start gap-4">
                <sector.icon className="mt-1 h-6 w-6 shrink-0 text-primary" />
                <span>
                  <span className="flex items-center gap-2 text-lg font-semibold">{sector.label}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
                  <span className="mt-1 block text-sm text-muted-foreground">{sectorBlurb[sector.to]}</span>
                </span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Sector page block: the sector's short video next to a short pitch. */
export function SectorVideoBlock({ sector }: { sector: "educacion" | "seleccion" | "psicologia" }) {
  const video = landingVideos[sector];
  return (
    <section className="border-y border-border bg-secondary/30">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-primary">Vídeo · {video.duration}</p>
          <h2 className="mt-2 text-3xl tracking-normal">{video.title}</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">Un resumen rápido de lo que Xandralyze puede hacer por ti. Dale al play con el sonido activado.</p>
        </div>
        <ClipVideo video={video} className="mx-auto aspect-[9/16] w-72 max-w-full" />
      </div>
    </section>
  );
}

const assistantPoints = [
  { icon: MessageCircle, title: "Escríbele o háblale", body: "Pregúntale con el teclado o con el micrófono, también desde el móvil." },
  { icon: Sparkles, title: "Te explica la app", body: "Conoce cada parte: simulaciones, exámenes, grabaciones, informes, ajustes… y un botón «Ir a…» te lleva directamente." },
  { icon: Volume2, title: "Te contesta en voz alta", body: "Responde con voz natural usando tu propia clave de IA, o con la voz del navegador si no tienes. Puedes silenciarla." },
  { icon: GripVertical, title: "No estorba", body: "Arrástrala a donde menos moleste o minimízala en una burbuja; se queda donde la dejaste." },
];

/** Homepage section presenting the in-app assistant with its video. */
export function AssistantShowcase() {
  return (
    <section id="asistente" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div>
          <p className="text-sm font-semibold text-primary">Nuevo · Dentro de la app</p>
          <h2 className="mt-2 text-3xl font-bold md:text-4xl">Tu asistente personal en Xandralyze</h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Una asistente te acompaña en todas las pantallas. Resuelve dudas sobre cómo usar la aplicación y responde a preguntas libres con tu propia IA.
          </p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2">
            {assistantPoints.map((p) => (
              <li key={p.title} className="flex gap-3">
                <p.icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <span><span className="block font-semibold">{p.title}</span><span className="mt-1 block text-sm text-muted-foreground">{p.body}</span></span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild className="gap-2"><Link to="/auth">Probar la asistente <ArrowRight className="h-4 w-4" /></Link></Button>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Mic className="h-4 w-4" /> Gratis · aparece al entrar en tu cuenta</span>
          </div>
        </div>
        <ClipVideo video={landingVideos.asistente} className="aspect-[4/5] w-full" />
      </div>
    </section>
  );
}
