export function buildContentSecurityPolicy(options: { readonly dev: boolean }): string {
  const scriptSrcDirectives = [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    ...(options.dev ? ["'unsafe-eval'"] : []),
  ];

  const directives: ReadonlyArray<string> = [
    "default-src 'self'",
    `script-src ${scriptSrcDirectives.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return directives.join("; ");
}

export function buildSecurityHeaders(options: {
  readonly dev: boolean;
}): ReadonlyArray<{ readonly key: string; readonly value: string }> {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
  ];
}
