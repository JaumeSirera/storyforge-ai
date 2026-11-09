import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo-xandralyze.png";
import { Button } from "@/components/ui/button";
import { CONTACT, OPEN_SOURCE } from "@/lib/features";
import { sectorLinks } from "@/components/SectorLanding";
import { ArrowRight, Bug, GitBranch, HandHeart, Mail, MonitorPlay, BookOpen, Smartphone } from "lucide-react";

const TITLE = "Contacto | Xandralyze, IA open source para educación y selección";
const DESCRIPTION = "Escribe al equipo de Xandralyze, informa de errores en GitHub o únete como colaborador. Todos los enlaces del proyecto en una sola página.";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://xandralyze.com/contacto" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: "https://xandralyze.com/og-xandralyze.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: "https://xandralyze.com/og-xandralyze.png" },
    ],
    links: [{ rel: "canonical", href: "https://xandralyze.com/contacto" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contacto de Xandralyze",
        url: "https://xandralyze.com/contacto",
        inLanguage: "es",
        mainEntity: {
          "@type": "Organization",
          name: "Xandralyze",
          url: "https://xandralyze.com/",
          email: CONTACT.email,
          sameAs: [OPEN_SOURCE.repoUrl],
        },
      }),
    }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const channels = [
    { Icon: Mail, title: "Correo", text: "Dudas, propuestas para tu centro o empresa y prensa.", href: `mailto:${CONTACT.email}`, label: CONTACT.email, external: false },
    { Icon: Bug, title: "Errores y sugerencias", text: "Abre una incidencia pública en GitHub para que cualquiera pueda seguirla.", href: `${OPEN_SOURCE.repoUrl}/issues`, label: "Abrir incidencia", external: true },
    { Icon: GitBranch, title: "Código fuente", text: `Repositorio público bajo licencia ${OPEN_SOURCE.license}.`, href: OPEN_SOURCE.repoUrl, label: "Ver en GitHub", external: true },
  ];
  const links = [
    { to: "/", hash: "demo", label: "Simulación de ejemplo", Icon: MonitorPlay },
    { to: "/", hash: "demo-evaluacion", label: "Corrección de exámenes de ejemplo", Icon: MonitorPlay },
    { to: "/guia", hash: undefined, label: "Guías", Icon: BookOpen },
    { to: "/open-source", hash: undefined, label: "Cómo colaborar", Icon: HandHeart },
    { to: "/install", hash: undefined, label: "Instalar la app móvil", Icon: Smartphone },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <img src={logo} alt="Logotipo de Xandralyze" width={36} height={36} className="h-9 w-9 object-contain" />
            Xandralyze
          </Link>
          <Button asChild size="sm"><Link to="/auth">Empezar gratis</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">Contacto</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Xandralyze es un proyecto gratuito y de código abierto. Escríbenos, informa de un error o súmate como colaborador.
        </p>

        <section aria-labelledby="canales" className="mt-12">
          <h2 id="canales" className="text-2xl font-semibold">Cómo contactar</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-3">
            {channels.map(({ Icon, title, text, href, label, external }) => (
              <article key={title} className="border-t border-border pt-6">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                <a
                  href={href}
                  {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="mt-4 inline-flex items-center gap-2 break-all font-medium text-primary hover:underline"
                >
                  {label} <ArrowRight className="h-4 w-4 shrink-0" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="enlaces" className="mt-16">
          <h2 id="enlaces" className="text-2xl font-semibold">Enlaces útiles</h2>
          <div className="mt-6 grid gap-10 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Probar y aprender</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {links.map(({ to, hash, label, Icon }) => (
                  <li key={label}>
                    <Link to={to} hash={hash} className="flex items-center gap-3 py-3 hover:text-primary">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />{label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por sector</h3>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {sectorLinks.map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link to={to} className="flex items-center gap-3 py-3 hover:text-primary">
                      <Icon className="h-4 w-4 text-primary" aria-hidden />{label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Xandralyze · <Link to="/" className="hover:text-foreground">Inicio</Link>
      </footer>
    </div>
  );
}
