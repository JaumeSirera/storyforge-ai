import { createFileRoute } from "@tanstack/react-router";
import { GuideArticle } from "@/components/GuideArticle";
import { guideHead } from "@/lib/guides";

const slug = "generador-preguntas-tipo-test";

export const Route = createFileRoute("/guia/generador-preguntas-tipo-test")({
  head: () => guideHead(slug),
  component: GuidePage,
});

function GuidePage() { return <GuideArticle slug={slug} />; }
