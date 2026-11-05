/** Response headers for ASVS 5.0 web frontend controls. Production CSP stays strict; Vite HMR needs a looser policy. */
export function securityHeaders(requestUrl: string, isProd: boolean): Record<string, string> {
  let https = false;
  try {
    https = new URL(requestUrl).protocol === "https:";
  } catch {
    https = false;
  }
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy(isProd),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  if (https) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

function contentSecurityPolicy(isProd: boolean) {
  const script = isProd ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const connect = isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss: http: https:";
  return [
    "default-src 'self'",
    script,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    connect,
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

export function withSecurityHeaders(response: Response, request: Request, isProd: boolean) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(request.url, isProd)))
    headers.set(name, value);
  if ((headers.get("content-type") ?? "").includes("text/html"))
    headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
