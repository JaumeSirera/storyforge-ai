import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo-xandralyze.png";
import { guides, SITE } from "@/lib/guides";

const title = "Guías de evaluación con IA y simulaciones interactivas | Xandralyze";
const description = "Guías prácticas y gratuitas: corrección de exámenes manuscritos con IA, rúbricas por competencias y simuladores de entrevistas para selección.";

export const Route = createFileRoute("/guia/")({
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE}/guia` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/guia` }],
  }),
  component: GuidesIndex,
});

function GuidesIndex() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold"><img src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />Xandralyze</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-balance text-4xl font-bold tracking-normal">Guías de evaluación con IA</h1>
        <p className="mt-4 text-lg text-muted-foreground">Paso a paso, con ejemplos que puedes probar sin cuenta.</p>
        <ul className="mt-10 space-y-6">
          {guides.map((g) => (
            <li key={g.slug} className="rounded-lg border border-border p-6">
              <p className="text-sm font-semibold text-primary">{g.category}</p>
              <h2 className="mt-2 text-xl tracking-normal"><a href={`/guia/${g.slug}`} className="hover:underline">{g.h1}</a></h2>
              <p className="mt-2 text-muted-foreground">{g.description}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
