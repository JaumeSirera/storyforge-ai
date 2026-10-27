import { createFileRoute } from "@tanstack/react-router";
import { SectorLanding, sectorHead } from "@/components/SectorLanding";

export const Route = createFileRoute("/psicologia")({
  head: () => sectorHead("psicologia"),
  component: PsychologyPage,
});

function PsychologyPage() { return <SectorLanding sector="psicologia" />; }