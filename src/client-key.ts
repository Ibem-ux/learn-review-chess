export function resolveClientKey(headers: Headers): string {
  const header = headers.get("x-forwarded-for");
  if (!header) {
    return "unknown";
  }
  const parts = header
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.at(-1) ?? "unknown";
}
