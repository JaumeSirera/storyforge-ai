import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo-xandralyze.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OPEN_SOURCE } from "@/lib/features";
import { CheckCircle2, GitBranch, HandHeart, KeyRound, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/open-source")({
  head: () => ({
    meta: [
      { title: "Gratis y de código abierto — Xandralyze" },
      { name: "description", content: "Xandralyze es gratuito y de código abierto (AGPL-3.0). Únete como colaborador y propón mejoras." },
      { property: "og:title", content: "Gratis y de código abierto — Xandralyze" },
      { property: "og:description", content: "Simulaciones interactivas con IA, gratis y abiertas. Participa como colaborador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpenSourcePage,
});

const steps = [
  { Icon: HandHeart, title: "1. Solicita ser colaborador", text: "Crea tu cuenta y pide el rol de colaborador desde la sección Colaborar de la app." },
  { Icon: ShieldCheck, title: "2. Administración lo aprueba", text: "Revisamos cada solicitud. Recibirás un correo con la decisión." },
  { Icon: GitBranch, title: "3. Envía propuestas", text: "Mejoras, funciones, correcciones o contenidos. Los cambios de código, por GitHub." },
  { Icon: CheckCircle2, title: "4. Se ratifican", text: "Ninguna modificación se incorpora sin la aprobación de administración." },
];

function OpenSourcePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <img src={logo} alt="Logotipo de Xandralyze" className="h-9 w-auto" width={36} height={36} />
          <span>Xandralyze</span>
        </Link>
        <Link to="/auth"><Button size="sm">Empezar gratis</Button></Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16 space-y-14">
        <section className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">Gratis y de código abierto</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Xandralyze no cobra nada. El código es público bajo la licencia {OPEN_SOURCE.license}: cualquiera puede
            usarlo, estudiarlo y mejorarlo, siempre que comparta también sus cambios.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={OPEN_SOURCE.repoUrl} target="_blank" rel="noreferrer">
              <Button size="lg" className="gap-2"><GitBranch className="h-4 w-4" /> Ver el código</Button>
            </a>
            <Link to="/app/contribute"><Button size="lg" variant="outline" className="gap-2"><HandHeart className="h-4 w-4" /> Quiero colaborar</Button></Link>
          </div>
        </section>
        <section>
          <Card>
            <CardContent className="flex gap-4 p-6">
              <KeyRound className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                La plataforma es gratuita. Las funciones de IA usan tu propia clave del proveedor (OpenAI, Gemini,
                ElevenLabs, Replicate), que guardas en Ajustes: pagas directamente a ese proveedor solo lo que consumes.
              </p>
            </CardContent>
          </Card>
        </section>
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Cómo participar</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {steps.map(({ Icon, title, text }) => (
              <Card key={title}>
                <CardContent className="space-y-2 p-6">
                  <Icon className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
