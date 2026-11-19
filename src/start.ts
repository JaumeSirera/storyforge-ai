import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachAnyAuth } from "./lib/auth-attacher-own";

const errorMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }

  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Search engines should see one address: send www.xandralyze.com to xandralyze.com.
const canonicalHostMiddleware = createMiddleware().server(async ({ request, next }) => {
  const url = new URL(request.url);
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host)
    .split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  if (host === "www.xandralyze.com") {
    return new Response(null, {
      status: 301,
      headers: { location: `https://xandralyze.com${url.pathname}${url.search}` },
    });
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachAnyAuth],
  requestMiddleware: [canonicalHostMiddleware, errorMiddleware],
}));
