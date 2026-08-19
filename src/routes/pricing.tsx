import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/logo-xandralyze.png.asset.json";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Heart,
  KeyRound,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Infinity,
  Zap,
  CheckCircle2,
  HelpCircle,
  Coffee,
  Sprout,
  Rocket,
  Diamond,
} from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Precios — Xandralyze" },
      {
        name: "description",
        content:
          "Xandralyze es gratuito: cada usuario paga directamente a su proveedor de IA según los tokens consumidos. Apoya la plataforma con una donación para mantenerla activa.",
      },
      {
        property: "og:title",
        content: "Precios — Xandralyze",
      },
      {
        property: "og:description",
        content:
          "Modelo abierto: tú eliges tu proveedor de IA y pagas solo lo que consumes. Donaciones para mantener la plataforma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

const donationTiers = [
  { amount: 5, label: "Café", Icon: Coffee, description: "Una pequeña ayuda que suma." },
  { amount: 10, label: "Soporte", Icon: Sprout, description: "Mantiene el servidor encendido." },
  { amount: 25, label: "Impulso", Icon: Rocket, description: "Financia mejoras continuas." },
  { amount: 50, label: "Patrocinio", Icon: Diamond, description: "Reconocimiento como patrocinador." },
];

const included = [
  "Crear simulaciones y evaluaciones ilimitadas",
  "Editor visual de ramificaciones",
  "Grabación de cámara y pantalla",
  "Multicámara en sesiones grupales",
  "Informes integrados en PDF",
  "Invitaciones y tokens de examen",
];

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <Hero />
        <OpenModel />
        <DonationSection />
        <Included />
        <Faq />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg" aria-label="Xandralyze — inicio">
          <img
            src={logoAsset.url}
            alt="Logotipo de Xandralyze"
            className="h-8 w-auto"
            width={32}
            height={32}
          />
          <span className="text-primary">Xandralyze</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/explore" className="hover:text-foreground">Galería</Link>
          <Link to="/pricing" className="text-foreground font-medium">Precios</Link>
          <Link to="/auth" className="hover:text-foreground">Entrar</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button size="sm">Empezar gratis</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="text-center">
      <Badge variant="secondary" className="mb-6">
        <Heart className="mr-1.5 h-3.5 w-3.5 text-destructive" />
        Modelo sostenible y transparente
      </Badge>
      <h1 className="mx-auto max-w-4xl text-balance text-4xl md:text-6xl font-bold tracking-tight">
        Gratis en uso. Pagas la IA a tu proveedor. Donas para mantenerlo.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
        Xandralyze no cobra por simulación, evaluación ni candidato. Cada usuario conecta sus propias
        claves de IA y paga directamente a OpenAI, Google, Anthropic o el proveedor que elija según
        lo que consume. Una donación voluntaria mantiene la plataforma activa.
      </p>
    </section>
  );
}

function OpenModel() {
  return (
    <section className="mt-20">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-soft">
          <CardHeader>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle className="mt-4">Tus claves, tu proveedor</CardTitle>
            <CardDescription>
              Conecta la API de OpenAI, Google Gemini, Anthropic u otra. Nunca pagas a Xandralyze por
              tokens: la factura va directa a tu cuenta de proveedor.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Infinity className="h-5 w-5" />
            </div>
            <CardTitle className="mt-4">Sin límites artificiales</CardTitle>
            <CardDescription>
              Simulaciones, escenas, preguntas, evaluaciones, candidatos y grabaciones ilimitadas.
              La única restricción es la capacidad de tu proveedor de IA.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="mt-4">Privacidad por diseño</CardTitle>
            <CardDescription>
              Tú eliges qué datos envías a cada modelo. Nada se procesa obligatoriamente por un
              proveedor único: alterna proveedores según sensibilidad y coste.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </section>
  );
}

function DonationSection() {
  return (
    <section className="mt-24 rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-chart-4/10 to-primary/5 p-8 md:p-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
          <Heart className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">
          Donación para mantener Xandralyze activo
        </h2>
        <p className="mt-3 text-muted-foreground">
          Sin cuotas obligatorias ni suscripciones. Si la plataforma te ahorra tiempo o mejora tus
          evaluaciones, puedes aportar lo que consideres justo. Cada donación se destina a servidores,
          soporte y desarrollo.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {donationTiers.map((tier) => (
          <Card
            key={tier.amount}
            className="overflow-hidden border-border/60 bg-card/80 shadow-soft transition hover:shadow-glow"
          >
            <CardHeader className="text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden>
                <tier.Icon className="h-6 w-6" />
              </div>
              <CardTitle className="mt-2 text-2xl font-bold">{tier.amount}€</CardTitle>
              <CardDescription>{tier.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">{tier.description}</p>
              <Link to="/app/billing" className="mt-4 block w-full">
                <Button variant="outline" className="w-full">
                  Donar {tier.amount}€
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          También puedes hacer una donación personalizada desde tu área de facturación.
        </p>
        <Link to="/app/billing" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Ir a facturación <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

function Included() {
  return (
    <section className="mt-24">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Todo incluido sin coste
          </h2>
          <p className="mt-3 text-muted-foreground">
            No existen planes ni funciones bloqueadas. Esto es parte de la plataforma y no tiene
            cargo adicional:
          </p>
          <ul className="mt-6 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-semibold">Lo que sí pagas</h3>
          </div>
          <p className="mt-4 text-muted-foreground">
            Generar texto, imágenes, voz o vídeo con IA consume tokens, segundos o créditos del
            proveedor que tengas configurado. Tú pagas eso directamente a tu proveedor.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-secondary p-4">
              <Zap className="mb-2 h-4 w-4 text-primary" />
              <span className="font-medium">Texto</span>
              <p className="mt-1 text-muted-foreground">Por tokens de entrada y salida</p>
            </div>
            <div className="rounded-xl bg-secondary p-4">
              <Wallet className="mb-2 h-4 w-4 text-primary" />
              <span className="font-medium">Voz y vídeo</span>
              <p className="mt-1 text-muted-foreground">Por caracteres o segundos</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "¿Tengo que pagar algo para usar Xandralyze?",
    a: "No. La plataforma es gratuita. Solo pagas a tu proveedor de IA por lo que consumes al generar contenido.",
  },
  {
    q: "¿Por qué debería donar?",
    a: "Las donaciones cubren los servidores, el soporte y el desarrollo continuo. Sin ellas, el proyecto no podría seguir activo.",
  },
  {
    q: "¿Puedo cambiar de proveedor de IA?",
    a: "Sí. Puedes configurar diferentes claves API para distintos motores y elegir el más adecuado por coste o calidad.",
  },
  {
    q: "¿Hay límite de candidatos o simulaciones?",
    a: "No. Dentro de Xandralyze puedes crear y compartir todo lo que necesites. El único límite real es el presupuesto de tu proveedor de IA.",
  },
];

function Faq() {
  return (
    <section className="mt-24">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {faqs.map((f) => (
          <Card key={f.q} className="shadow-soft">
            <CardHeader className="flex flex-row items-start gap-3">
              <HelpCircle className="mt-1 h-5 w-5 shrink-0 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">{f.q}</CardTitle>
                <CardDescription className="mt-2">{f.a}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mt-24 rounded-3xl border border-border bg-gradient-to-br from-primary to-chart-4 p-10 md:p-14 text-center text-primary-foreground shadow-glow">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
        Empieza sin coste y conecta tu proveedor de IA
      </h2>
      <p className="mt-3 opacity-90">
        Crea tu primera simulación en minutos. Solo pagarás a tu proveedor por lo que generes.
      </p>
      <Link to="/auth" className="mt-8 inline-block">
        <Button size="lg" variant="secondary" className="gap-2">
          Crear cuenta gratuita <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
      © {new Date().getFullYear()} Xandralyze. Interacción humana impulsada por IA.
    </footer>
  );
}
