import { createServerFn } from "@tanstack/react-start";
import { requireAnyAuth } from "@/lib/require-auth";
import { z } from "zod";
import { xdb, xAdminDb } from "./assessments-repo.server";

type AuthContext = {
  supabase: any;
  userId: string;
  claims?: Record<string, unknown>;
  accessToken?: string;
  authMode?: "cloud" | "own";
};

/** Cuentas propias (API PHP): devuelve el cliente y el token, o null. */
async function ownAccounts(context: AuthContext) {
  if (context.authMode !== "own") return null;
  const { accountsApi, ownAccountsEnabled } = await import("./accounts.server");
  if (!ownAccountsEnabled()) return null;
  return { accountsApi, token: String(context.accessToken ?? "") };
}

/** ¿Es administrador el usuario autenticado? */
async function isAdminUser(context: AuthContext): Promise<boolean> {
  if (context.authMode === "own") {
    const roles = context.claims?.["roles"];
    return Array.isArray(roles) && roles.map(String).includes("admin");
  }
  const { data } = await xdb(context).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  return !!data;
}

/** Guardián: verifica que el usuario autenticado es admin y devuelve el cliente admin. */
async function ensureAdmin(context: AuthContext) {
  if (!(await isAdminUser(context))) throw new Error("Forbidden");
  return await xAdminDb();
}

/** Devuelve si el usuario actual es administrador. */
export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    return { isAdmin: await isAdminUser(context) };
  });

/** Lista todos los usuarios con perfil, roles y estado. */
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const admin = await ensureAdmin(context);
    const own = await ownAccounts(context);

    if (own) {
      const { users } = await own.accountsApi.adminUsers(own.token);
      const ids = users.map((u) => u.id);
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, use_platform_ai")
        .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const aiMap = new Map((profiles ?? []).map((p: any) => [p.id, !!p.use_platform_ai]));
      return {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          emailConfirmed: u.email_verified,
          createdAt: u.created_at,
          isActive: !u.disabled,
          usePlatformAi: aiMap.get(u.id) ?? false,
          roles: u.roles,
          banned: u.disabled,
        })),
      };
    }

    const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (authErr) throw new Error(authErr.message);

    const users = authData.users;
    const ids = users.map((u) => u.id);

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, is_active, use_platform_ai")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      rolesMap.set(r.user_id, arr);
    }

    return {
      users: users.map((u) => {
        const p = profileMap.get(u.id) as any;
        return {
          id: u.id,
          email: u.email ?? p?.email ?? null,
          fullName: p?.full_name ?? (u.user_metadata?.full_name as string | undefined) ?? null,
          emailConfirmed: !!u.email_confirmed_at,
          createdAt: u.created_at,
          isActive: p?.is_active ?? true,
          usePlatformAi: p?.use_platform_ai ?? false,
          roles: rolesMap.get(u.id) ?? [],
          banned: !!(u as any).banned_until,
        };
      }),
    };
  });

const CreateInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().trim().max(200).optional(),
  isAdmin: z.boolean().optional(),
  usePlatformAi: z.boolean().optional(),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    const admin = await ensureAdmin(context);
    const own = await ownAccounts(context);

    if (own) {
      const created = await own.accountsApi.adminCreate(own.token, {
        email: data.email,
        password: data.password,
        ...(data.fullName ? { full_name: data.fullName } : {}),
        is_admin: !!data.isAdmin,
      });
      await admin.from("profiles").upsert({
        id: created.user_id,
        email: data.email,
        full_name: data.fullName ?? null,
        use_platform_ai: !!data.usePlatformAi,
        is_active: true,
      });
      return { ok: true, userId: created.user_id };
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : undefined,
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await admin.from("profiles").upsert({
      id: uid,
      email: data.email,
      full_name: data.fullName ?? null,
      use_platform_ai: !!data.usePlatformAi,
      is_active: true,
    });
    if (data.isAdmin) {
      await admin.from("user_roles").insert({ user_id: uid, role: "admin" }).select();
    }
    return { ok: true, userId: uid };
  });

const UpdateInput = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
  usePlatformAi: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) => UpdateInput.parse(v))
  .handler(async ({ data, context }) => {
    const admin = await ensureAdmin(context);
    const own = await ownAccounts(context);

    const profilePatch: {
      id: string;
      full_name?: string | null;
      is_active?: boolean;
      use_platform_ai?: boolean;
    } = { id: data.userId };
    if (data.fullName !== undefined) profilePatch.full_name = data.fullName;
    if (data.isActive !== undefined) profilePatch.is_active = data.isActive;
    if (data.usePlatformAi !== undefined) profilePatch.use_platform_ai = data.usePlatformAi;
    if (Object.keys(profilePatch).length > 1) {
      const { error } = await admin.from("profiles").upsert(profilePatch);
      if (error) throw new Error(error.message);
    }

    if (own) {
      await own.accountsApi.adminUpdate(own.token, {
        user_id: data.userId,
        ...(data.fullName !== undefined ? { full_name: data.fullName } : {}),
        ...(data.isActive !== undefined ? { disabled: !data.isActive } : {}),
        ...(data.isAdmin !== undefined ? { is_admin: data.isAdmin } : {}),
      });
      return { ok: true };
    }

    // Ban/unban via auth admin (used to disable login)
    if (data.isActive !== undefined) {
      await admin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.isActive ? "none" : "876000h", // ~100 años
      } as any);
    }

    if (data.isAdmin !== undefined) {
      if (data.isAdmin) {
        await admin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await admin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
      }
    }

    return { ok: true };
  });

const PasswordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8),
});

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) => PasswordInput.parse(v))
  .handler(async ({ data, context }) => {
    const admin = await ensureAdmin(context);
    const own = await ownAccounts(context);
    if (own) {
      await own.accountsApi.adminSetPassword(own.token, {
        user_id: data.userId,
        password: data.password,
      });
      return { ok: true };
    }
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteInput = z.object({ userId: z.string().uuid() });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireAnyAuth])
  .inputValidator((v: unknown) => DeleteInput.parse(v))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propia cuenta.");
    }
    const admin = await ensureAdmin(context);
    const own = await ownAccounts(context);
    if (own) {
      await own.accountsApi.adminDelete(own.token, { user_id: data.userId });
      return { ok: true };
    }
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista todas las simulaciones del sistema para el panel de admin. */
export const adminListAllSimulations = createServerFn({ method: "GET" })
  .middleware([requireAnyAuth])
  .handler(async ({ context }) => {
    const admin = await ensureAdmin(context);
    const { data, error } = await admin
      .from("simulations")
      .select("id, title, topic, status, is_public, owner_id, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ownerIds = Array.from(new Set((data ?? []).map((s) => s.owner_id)));
    const { data: profs } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ownerIds.length ? ownerIds : ["00000000-0000-0000-0000-000000000000"]);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));

    return {
      simulations: (data ?? []).map((s) => ({
        ...s,
        owner: pmap.get(s.owner_id) ?? null,
      })),
    };
  });
