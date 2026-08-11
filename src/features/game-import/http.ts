export const REQUEST_TIMEOUT_MS = 8000;
export const MAX_RESPONSE_BYTES = 5000000;

export type FetchLike = (
  input: string,
  init?: {
    readonly headers?: Readonly<Record<string, string>>;
    readonly signal?: AbortSignal;
  }
) => Promise<{ readonly status: number; readonly headers: Readonly<Record<string, string>>; readonly text: () => Promise<string> }>;

export function getContentLength(headers: Readonly<Record<string, string>>): number | undefined {
  const value = headers["content-length"] ?? headers["Content-Length"];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return undefined;
}

export type ReadBodyResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: string };

export async function readResponseTextSafely(response: {
  readonly headers: Readonly<Record<string, string>>;
  readonly text: () => Promise<string>;
}): Promise<ReadBodyResult> {
  const contentLength = getContentLength(response.headers);
  if (contentLength !== undefined && contentLength > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      reason: `Response Content-Length of ${contentLength} bytes exceeds limit of ${MAX_RESPONSE_BYTES} bytes.`,
    };
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      reason: `Response body length of ${text.length} bytes exceeds limit of ${MAX_RESPONSE_BYTES} bytes.`,
    };
  }

  return { ok: true, text };
}

export function parseRetryAfter(headers: Readonly<Record<string, string>>): number | undefined {
  const value = headers["retry-after"] ?? headers["Retry-After"];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}
