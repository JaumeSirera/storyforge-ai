import { createFileRoute } from "@tanstack/react-router";
import { SectorLanding, sectorHead } from "@/components/SectorLanding";

export const Route = createFileRoute("/educacion")({
  head: () => sectorHead("educacion"),
  component: EducationPage,
});

function EducationPage() { return <SectorLanding sector="educacion" />; }