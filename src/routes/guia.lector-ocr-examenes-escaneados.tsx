import { createFileRoute } from "@tanstack/react-router";
import { GuideArticle } from "@/components/GuideArticle";
import { guideHead } from "@/lib/guides";

const slug = "lector-ocr-examenes-escaneados";

export const Route = createFileRoute("/guia/lector-ocr-examenes-escaneados")({
  head: () => guideHead(slug),
  component: GuidePage,
});

function GuidePage() { return <GuideArticle slug={slug} />; }
