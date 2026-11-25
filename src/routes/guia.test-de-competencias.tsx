import { createFileRoute } from "@tanstack/react-router";
import { GuideArticle } from "@/components/GuideArticle";
import { guideHead } from "@/lib/guides";

const slug = "test-de-competencias";

export const Route = createFileRoute("/guia/test-de-competencias")({
  head: () => guideHead(slug),
  component: GuidePage,
});

function GuidePage() { return <GuideArticle slug={slug} />; }
