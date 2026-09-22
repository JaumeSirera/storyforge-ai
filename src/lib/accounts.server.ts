/**
 * Cuentas propias (fase A): la identidad vive en la API PHP + MySQL.
 *
 * Server-only: importar siempre con `await import("@/lib/accounts.server")`
 * dentro del handler de una server function.
 */

import { externalRequest, isExternalApiEnabled } from "./external-data.server";

export interface AccountUser {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  roles: string[];
  created_at: string;
}

export interface AccountSession {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  user: AccountUser;
  /** Solo en el registro: token del enlace de verificación de email. */
  verification_token?: string;
}

/** ¿Están activas las cuentas propias? */
export function ownAccountsEnabled(): boolean {
  return isExternalApiEnabled() && process.env["EXTERNAL_ACCOUNTS"] === "1";
}

function post<T>(path: string, body: Record<string, unknown>, accessToken = ""): Promise<T> {
  return externalRequest<T>({ accessToken, method: "POST", path, body });
}

export const accountsApi = {
  register(input: { email: string; password: string; full_name?: string }) {
    return post<AccountSession>("/auth/register", input);
  },
  login(input: { email: string; password: string }) {
    return post<AccountSession>("/auth/login", input);
  },
  refresh(refreshToken: string) {
    return post<AccountSession>("/auth/refresh", { refresh_token: refreshToken });
  },
  logout(refreshToken: string) {
    return post<{ ok: boolean }>("/auth/logout", { refresh_token: refreshToken });
  },
  forgot(email: string) {
    return post<{ ok: boolean; token: string | null; email: string; full_name: string | null }>(
      "/auth/forgot",
      { email },
    );
  },
  reset(input: { token: string; password: string }) {
    return post<AccountSession>("/auth/reset", input);
  },
  verify(token: string) {
    return post<{ ok: boolean }>("/auth/verify", { token });
  },
  changePassword(accessToken: string, input: { current_password: string; new_password: string }) {
    return post<{ ok: boolean }>("/auth/password", input, accessToken);
  },
  me(accessToken: string) {
    return externalRequest<AccountUser>({ accessToken, path: "/auth/me" });
  },
  updateProfile(accessToken: string, input: { full_name?: string }) {
    return externalRequest<AccountUser>({
      accessToken,
      method: "PATCH",
      path: "/auth/profile",
      body: input,
    });
  },
  /** Modo servicio: alta masiva de las cuentas que ya existían. */
  import(users: Array<{ id: string; email: string; full_name?: string | null; email_verified?: boolean; roles?: string[] }>) {
    return post<{
      imported: number;
      skipped: number;
      invites: Array<{ id: string; email: string; full_name: string | null; token: string }>;
    }>("/auth/import", { users });
  },

  // ---- Administración (rol admin, o modo servicio con token vacío) ----
  adminUsers(accessToken: string) {
    return externalRequest<{ users: AdminAccount[] }>({ accessToken, path: "/auth/users" });
  },
  adminCreate(
    accessToken: string,
    input: { email: string; password: string; full_name?: string; is_admin?: boolean },
  ) {
    return externalRequest<{ ok: boolean; user_id: string }>({
      accessToken,
      method: "POST",
      path: "/auth/users",
      body: input,
    });
  },
  adminUpdate(
    accessToken: string,
    input: { user_id: string; full_name?: string | null; disabled?: boolean; is_admin?: boolean },
  ) {
    return externalRequest<{ ok: boolean }>({
      accessToken,
      method: "PATCH",
      path: "/auth/users",
      body: input,
    });
  },
  adminSetPassword(accessToken: string, input: { user_id: string; password: string }) {
    return post<{ ok: boolean }>("/auth/users/password", input, accessToken);
  },
  adminDelete(accessToken: string, input: { user_id: string }) {
    return post<{ ok: boolean }>("/auth/users/delete", input, accessToken);
  },
  setRole(
    accessToken: string,
    input: { email?: string; user_id?: string; role: string; action?: "add" | "remove" },
  ) {
    return post<{ ok: boolean; user_id: string; roles: string[] }>("/auth/users/role", input, accessToken);
  },
};

export interface AdminAccount {
  id: string;
  email: string;
  full_name: string | null;
  email_verified: boolean;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}
