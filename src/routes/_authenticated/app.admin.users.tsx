import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminResetPassword,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";
import { KeyRound, Plus, Trash2, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/users")({
  component: AdminUsersPage,
});

type Row = {
  id: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  usePlatformAi: boolean;
  roles: string[];
  emailConfirmed: boolean;
  createdAt: string;
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminListUsers);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => list(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Usuarios</h2>
        <CreateUserDialog onCreated={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Usuario</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">IA</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users ?? []).map((u: Row) => (
                    <UserRow key={u.id} row={u} />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UserRow({ row }: { row: Row }) {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateUser);
  const del = useServerFn(adminDeleteUser);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const patch = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      update({ data: { userId: row.id, ...payload } } as any),
    onSuccess: () => {
      toast.success("Guardado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => del({ data: { userId: row.id } }),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = row.roles.includes("admin");

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2 align-top">
        <div className="font-medium">{row.fullName || "—"}</div>
        <div className="text-muted-foreground text-xs">{row.email}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <label className="flex items-center gap-2">
          <Switch
            checked={row.isActive}
            onCheckedChange={(v) => patch.mutate({ isActive: v })}
          />
          <span className="text-xs">{row.isActive ? "Activo" : "Desactivado"}</span>
        </label>
      </td>
      <td className="px-3 py-2 align-top">
        <label className="flex items-center gap-2">
          <Switch
            checked={row.usePlatformAi}
            onCheckedChange={(v) => patch.mutate({ usePlatformAi: v })}
          />
          <span className="text-xs">
            {row.usePlatformAi ? "Plataforma paga" : "Paga el usuario"}
          </span>
        </label>
      </td>
      <td className="px-3 py-2 align-top">
        <label className="flex items-center gap-2">
          <Switch
            checked={isAdmin}
            onCheckedChange={(v) => patch.mutate({ isAdmin: v })}
          />
          {isAdmin && <Badge variant="secondary">Admin</Badge>}
        </label>
      </td>
      <td className="px-3 py-2 align-top text-right">
        <div className="inline-flex gap-2">
          <ResetPasswordDialog userId={row.id} email={row.email ?? ""} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`¿Eliminar a ${row.email}? Esta acción no se puede deshacer.`)) {
                remove.mutate();
              }
            }}
            disabled={remove.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CreateUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [usePlatformAi, setUsePlatformAi] = useState(false);
  const create = useServerFn(adminCreateUser);

  const mut = useMutation({
    mutationFn: () =>
      create({ data: { email, password, fullName: fullName || undefined, isAdmin, usePlatformAi } }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setOpen(false);
      setEmail(""); setPassword(""); setFullName(""); setIsAdmin(false); setUsePlatformAi(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nuevo usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>El email quedará confirmado automáticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><Label>Nombre</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isAdmin} onCheckedChange={setIsAdmin} /> Administrador
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={usePlatformAi} onCheckedChange={setUsePlatformAi} /> IA pagada por la plataforma
          </label>
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !email || password.length < 6}>
            <UserCog className="h-4 w-4 mr-1" /> Crear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const reset = useServerFn(adminResetPassword);
  const mut = useMutation({
    mutationFn: () => reset({ data: { userId, password } }),
    onSuccess: () => {
      toast.success("Contraseña actualizada");
      setOpen(false);
      setPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><KeyRound className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>{email}</DialogDescription>
        </DialogHeader>
        <div><Label>Nueva contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || password.length < 6}>
            Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
