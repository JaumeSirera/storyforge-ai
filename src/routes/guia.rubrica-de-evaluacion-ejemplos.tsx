import { createFileRoute } from "@tanstack/react-router";
import { GuideArticle } from "@/components/GuideArticle";
import { guideHead } from "@/lib/guides";

const slug = "rubrica-de-evaluacion-ejemplos";

export const Route = createFileRoute("/guia/rubrica-de-evaluacion-ejemplos")({
  head: () => guideHead(slug),
  component: GuidePage,
});

function GuidePage() { return <GuideArticle slug={slug} />; }
