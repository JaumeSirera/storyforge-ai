import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-xandralyze.png";
import { guides } from "@/lib/guides";

export function GuideArticle({ slug }: { slug: string }) {
  const g = guides.find((x) => x.slug === slug)!;
  const related = guides.filter((x) => x.slug !== slug);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold"><img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />Xandralyze</Link>
          <nav className="flex gap-5 text-sm text-muted-foreground">
            <Link to="/guia" className="hover:text-foreground">Guías</Link>
            <Link to={g.backTo} className="hover:text-foreground">{g.backLabel}</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <nav aria-label="Ruta" className="text-sm text-muted-foreground"><Link to="/" className="hover:text-foreground">Inicio</Link> / <Link to="/guia" className="hover:text-foreground">Guías</Link></nav>
        <p className="mt-4 text-sm font-semibold text-primary">Guía · {g.category}</p>
        <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-normal">{g.h1}</h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{g.intro}</p>

        <h2 className="mt-12 text-2xl tracking-normal">{g.stepsTitle}</h2>
        <ol className="mt-6 space-y-8">
          {g.steps.map(([h, p], i) => (
            <li key={h}>
              <h3 className="text-xl tracking-normal"><span className="text-primary">{i + 1}.</span> {h}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">{p}</p>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-2xl tracking-normal">{g.tipsTitle}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>

        <h2 className="mt-12 text-2xl tracking-normal">Pruébalo sin registrarte</h2>
        <p className="mt-3 text-muted-foreground">{g.ctaText}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg"><a href={g.ctaHref}>{g.ctaLabel}<ArrowRight /></a></Button>
          <Button asChild variant="outline" size="lg"><Link to="/auth">Crear cuenta gratis</Link></Button>
        </div>

        <h2 className="mt-14 text-2xl tracking-normal">Otras guías</h2>
        <ul className="mt-4 space-y-2">
          {related.map((r) => <li key={r.slug}><a href={`/guia/${r.slug}`} className="font-medium text-primary hover:underline">{r.h1}</a></li>)}
        </ul>
      </main>
    </div>
  );
}
