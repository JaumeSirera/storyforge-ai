import { createFileRoute } from "@tanstack/react-router";
import { SectorLanding, sectorHead } from "@/components/SectorLanding";

export const Route = createFileRoute("/seleccion")({
  head: () => sectorHead("seleccion"),
  component: RecruitmentPage,
});

function RecruitmentPage() { return <SectorLanding sector="seleccion" />; }