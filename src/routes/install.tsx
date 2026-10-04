import { createFileRoute, Link } from "@tanstack/react-router";
import { Apple, ArrowRight, Share2, Smartphone, MoreVertical, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/logo-xandralyze.png";

export const Route = createFileRoute("/install")({
  component: InstallPage,
  head: () => ({
    meta: [
      { title: "Descargar la app de Xandralyze para móvil" },
      {
        name: "description",
        content:
          "Instala Xandralyze en tu móvil como aplicación web (PWA): instrucciones paso a paso para Android e iPhone/iPad.",
      },
      { property: "og:title", content: "Descargar la app de Xandralyze para móvil" },
      {
        property: "og:description",
        content:
          "Instala Xandralyze en Android o iOS como aplicación web, con icono propio y pantalla completa.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://iworkpre.lovable.app/install" },
      { property: "og:image", content: "https://iworkpre.lovable.app/og-xandralyze.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://iworkpre.lovable.app/og-xandralyze.png" },
    ],
    links: [{ rel: "canonical", href: "https://iworkpre.lovable.app/install" }],
  }),
});

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

function InstallPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-bold" aria-label="Xandralyze — inicio">
            <img src={logo} alt="Logotipo de Xandralyze" className="h-8 w-auto" width={32} height={32} />
            <span>Xandralyze</span>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="gap-2">
              Entrar <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5 text-primary" />
            Aplicación web instalable (PWA)
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">
            Descarga Xandralyze en tu móvil
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            No necesitas tienda de aplicaciones. Añade Xandralyze a la pantalla de inicio y se abrirá
            como una app: icono propio, pantalla completa y acceso directo a tus simulaciones,
            grabaciones y evaluaciones.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MoreVertical className="h-5 w-5 text-primary" aria-hidden="true" />
                Android (Chrome, Edge, Samsung Internet)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>
                  Abre <strong>xandralyze.com</strong> en Chrome desde el móvil.
                </Step>
                <Step n={2}>
                  Toca el menú <strong>⋮</strong> (arriba a la derecha).
                </Step>
                <Step n={3}>
                  Elige <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.
                </Step>
                <Step n={4}>Confirma «Instalar». El icono aparecerá con tus demás apps.</Step>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Apple className="h-5 w-5 text-primary" aria-hidden="true" />
                iPhone e iPad (Safari)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step n={1}>
                  Abre <strong>xandralyze.com</strong> en <strong>Safari</strong> (no funciona desde Chrome en iOS).
                </Step>
                <Step n={2}>
                  Toca el botón <strong>Compartir</strong> <Share2 className="inline h-3.5 w-3.5" aria-hidden="true" /> en la barra inferior.
                </Step>
                <Step n={3}>
                  Desliza y elige <strong>«Añadir a pantalla de inicio»</strong>.
                </Step>
                <Step n={4}>Pulsa «Añadir». Se creará el icono de Xandralyze.</Step>
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Qué obtienes al instalarla</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              "Icono propio y apertura a pantalla completa",
              "Grabación de cámara y pantalla con permisos nativos",
              "Acceso rápido a simulaciones y evaluaciones",
              "Se actualiza sola: siempre la última versión",
            ].map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Consejo: para grabar vídeo y audio, acepta los permisos de cámara y micrófono la primera
          vez que abras la app instalada.
        </p>
      </section>
    </main>
  );
}
