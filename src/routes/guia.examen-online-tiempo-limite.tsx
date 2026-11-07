import { createFileRoute } from "@tanstack/react-router";
import { GuideArticle } from "@/components/GuideArticle";
import { guideHead } from "@/lib/guides";

const slug = "examen-online-tiempo-limite";

export const Route = createFileRoute("/guia/examen-online-tiempo-limite")({
  head: () => guideHead(slug),
  component: GuidePage,
});

function GuidePage() { return <GuideArticle slug={slug} />; }
