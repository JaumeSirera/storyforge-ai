/**
 * Llamadas a la API propia con la sesión del usuario (cuentas propias).
 * Server-only.
 */
import { externalRequest } from "./external-data.server";

export type OwnCtx = { accessToken?: string; authMode?: "cloud" | "own" };

export function isOwn(context: OwnCtx): boolean {
  return context.authMode === "own";
}

export function ownApi<T>(
  context: OwnCtx,
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  return externalRequest<T>({ accessToken: String(context.accessToken ?? ""), method, path, body });
}

export interface Person {
  id: string;
  email: string | null;
  full_name: string | null;
}

export async function lookupPeople(context: OwnCtx, q: { email?: string; ids?: string[] }) {
  return ownApi<Person[]>(context, "/people/lookup", "POST", q);
}
