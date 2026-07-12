import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, LayoutDashboard, Plus, LogOut, Library, Settings, Shield } from "lucide-react";
import { getMyAdminStatus } from "@/lib/admin.functions";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/app/dashboard" className="flex items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            PlayGame
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavItem to="/app/dashboard" icon={LayoutDashboard} label="Inicio" />
            <NavItem to="/app/simulations" icon={Library} label="Mis simulaciones" />
            <NavItem to="/app/new" icon={Plus} label="Nueva" />
            <NavItem to="/app/settings" icon={Settings} label="Ajustes" />
          </nav>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition"
      activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
