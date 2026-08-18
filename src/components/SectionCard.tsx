import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

interface SectionCardProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  onClick?: () => void;
  to?: string;
  params?: Record<string, string>;
}

/** Tarjeta de acceso a una sección, con el mismo aspecto que en simulaciones y grabaciones. */
export function SectionCard({ icon: Icon, title, summary, onClick, to, params }: SectionCardProps) {
  const inner = (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="line-clamp-2">{summary}</CardDescription>
      </CardContent>
    </>
  );

  return (
    <Card className="transition-colors hover:border-primary/50">
      {to ? (
        <Link
          to={to as any}
          params={params as any}
          className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {inner}
        </button>
      )}
    </Card>
  );
}
