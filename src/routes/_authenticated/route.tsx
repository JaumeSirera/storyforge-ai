import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Plus, LogOut, Library, Settings, Shield, CreditCard, Menu, X , Video, FileText, Smartphone} from "lucide-react";
import { getMyAdminStatus } from "@/lib/admin.functions";
import logoAsset from "@/assets/logo-xandralyze.png.asset.json";


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
  const [mobileOpen, setMobileOpen] = useState(false);
  const check = useServerFn(getMyAdminStatus);
  const { data: adminStatus } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => check(),
    staleTime: 60_000,
  });

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 gap-2">
          <Link to="/app/dashboard" className="flex items-center gap-2 font-bold min-w-0" aria-label="Xandralyze — inicio">
            <img
              src={logoAsset.url}
              alt="Logotipo de Xandralyze"
              className="h-7 w-auto"
              width={28}
              height={28}
            />
            <span className="truncate">Xandralyze</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavItem to="/app/dashboard" icon={LayoutDashboard} label="Inicio" />
            <NavItem to="/app/simulations" icon={Library} label="Mis simulaciones" />
            <NavItem to="/app/new" icon={Plus} label="Nueva" />
            <NavItem to="/app/capture" icon={Video} label="Grabaciones" />
            <NavItem to="/app/assessments" icon={FileText} label="Evaluaciones" />
            <NavItem to="/app/settings" icon={Settings} label="Ajustes" />
            <NavItem to="/app/billing" icon={CreditCard} label="Facturación" />
            <NavItem to="/install" icon={Smartphone} label="App móvil" />
            {adminStatus?.isAdmin && (
              <NavItem to="/app/admin/users" icon={Shield} label="Admin" />
            )}
          </nav>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="hidden md:inline-flex" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Salir
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              aria-label="Menú"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <nav className="mx-auto flex max-w-7xl flex-col px-2 py-2 text-sm">
              <MobileNavItem to="/app/dashboard" icon={LayoutDashboard} label="Inicio" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/simulations" icon={Library} label="Mis simulaciones" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/new" icon={Plus} label="Nueva" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/capture" icon={Video} label="Grabaciones" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/assessments" icon={FileText} label="Evaluaciones" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/settings" icon={Settings} label="Ajustes" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/app/billing" icon={CreditCard} label="Facturación" onClick={() => setMobileOpen(false)} />
              <MobileNavItem to="/install" icon={Smartphone} label="App móvil" onClick={() => setMobileOpen(false)} />
              {adminStatus?.isAdmin && (
                <MobileNavItem to="/app/admin/users" icon={Shield} label="Admin" onClick={() => setMobileOpen(false)} />
              )}
              <button
                onClick={() => { setMobileOpen(false); void signOut(); }}
                className="mt-1 inline-flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground text-left"
              >
                <LogOut className="h-4 w-4" /> Salir
              </button>
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        aria-label="Navegación principal móvil"
      >
        <ul className="mx-auto grid max-w-7xl grid-cols-5">
          <li><BottomNavItem to="/app/dashboard" icon={LayoutDashboard} label="Inicio" /></li>
          <li><BottomNavItem to="/app/simulations" icon={Library} label="Simulaciones" /></li>
          <li><BottomNavItem to="/app/capture" icon={Video} label="Grabaciones" /></li>
          <li><BottomNavItem to="/app/assessments" icon={FileText} label="Evaluar" /></li>
          <li><BottomNavItem to="/app/settings" icon={Settings} label="Perfil" /></li>
        </ul>
      </nav>
    </div>
  );
}

function BottomNavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 mx-1 min-h-11 rounded-lg text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      activeProps={{ className: "bg-primary/10 text-primary font-medium", "aria-current": "page" }}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </Link>
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

function MobileNavItem({ to, icon: Icon, label, onClick }: { to: string; icon: any; label: string; onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition"
      activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
