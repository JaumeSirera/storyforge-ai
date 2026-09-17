/**
 * Puente entre el navegador y las cuentas propias del servidor del cliente.
 * La clave compartida con la API nunca sale del servidor.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AccountSession, AccountUser } from "./accounts.server";

const credentials = z.object({
  email: z.string().email("El email no es válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const ownAccountsStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { ownAccountsEnabled } = await import("./accounts.server");
  return { enabled: ownAccountsEnabled() };
});

export const registerAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    credentials.extend({ full_name: z.string().trim().max(200).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<AccountSession> => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.register(data);
  });

export const loginAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentials.parse(input))
  .handler(async ({ data }): Promise<AccountSession> => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.login(data);
  });

export const refreshAccountSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ refresh_token: z.string().min(10) }).parse(input))
  .handler(async ({ data }): Promise<AccountSession> => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.refresh(data.refresh_token);
  });

export const logoutAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ refresh_token: z.string().default("") }).parse(input))
  .handler(async ({ data }) => {
    const { accountsApi } = await import("./accounts.server");
    if (!data.refresh_token) return { ok: true };
    return accountsApi.logout(data.refresh_token);
  });

export const accountFromToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(10) }).parse(input))
  .handler(async ({ data }): Promise<AccountUser> => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.me(data.access_token);
  });

export const requestAccountPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const { accountsApi } = await import("./accounts.server");
    const result = await accountsApi.forgot(data.email);
    if (result.token) {
      const { sendPasswordEmail } = await import("./account-emails.server");
      await sendPasswordEmail({
        kind: "reset",
        email: result.email,
        fullName: result.full_name,
        token: result.token,
      });
    }
    // Nunca se revela si el email existe.
    return { ok: true };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(10), password: z.string().min(8) }).parse(input),
  )
  .handler(async ({ data }): Promise<AccountSession> => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.reset(data);
  });

export const verifyAccountEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.verify(data.token);
  });

export const changeAccountPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(10),
        current_password: z.string().min(1),
        new_password: z.string().min(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { accountsApi } = await import("./accounts.server");
    return accountsApi.changePassword(data.access_token, {
      current_password: data.current_password,
      new_password: data.new_password,
    });
  });
