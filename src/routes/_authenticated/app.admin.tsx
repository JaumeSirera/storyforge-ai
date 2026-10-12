import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyAdminStatus } from "@/lib/admin.functions";
import { Shield, Users, Library, DollarSign, HandHeart, Megaphone } from "lucide-react";
import { DONATIONS_ENABLED } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(getMyAdminStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => check(),
  });

  if (isLoading) return <div className="text-muted-foreground">Comprobando permisos…</div>;
  if (!data?.isAdmin) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold mb-2">Acceso restringido</h1>
        <p className="text-muted-foreground">Esta sección es solo para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" /> Administración
        </h1>
        <p className="text-muted-foreground text-sm">
          Gestión de usuarios y contenido de la plataforma.
        </p>
      </div>
      <nav className="flex gap-2 border-b border-border">
        <Link
          to="/app/admin/users"
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          activeProps={{ className: "text-foreground border-primary font-medium" }}
        >
          <span className="inline-flex items-center gap-2"><Users className="h-4 w-4" /> Usuarios</span>
        </Link>
        <Link
          to="/app/admin/simulations"
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          activeProps={{ className: "text-foreground border-primary font-medium" }}
        >
          <span className="inline-flex items-center gap-2"><Library className="h-4 w-4" /> Todas las simulaciones</span>
        </Link>
        <Link
          to="/app/admin/contributions"
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          activeProps={{ className: "text-foreground border-primary font-medium" }}
        >
          <span className="inline-flex items-center gap-2"><HandHeart className="h-4 w-4" /> Colaboración</span>
        </Link>
        <Link
          to="/app/admin/social"
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          activeProps={{ className: "text-foreground border-primary font-medium" }}
        >
          <span className="inline-flex items-center gap-2"><Megaphone className="h-4 w-4" /> Redes sociales</span>
        </Link>
        {DONATIONS_ENABLED && <Link
          to="/app/admin/pricing"
          className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
          activeProps={{ className: "text-foreground border-primary font-medium" }}
        >
          <span className="inline-flex items-center gap-2"><DollarSign className="h-4 w-4" /> Tarifas y márgenes</span>
        </Link>}
      </nav>
      <Outlet />
    </div>
  );
}
