export type RequestAbortError = {
  type?: unknown;
  code?: unknown;
  message?: unknown;
};

export function isClientRequestAbort(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { type, code, message } = error as RequestAbortError;
  return type === "request.aborted" || code === "ECONNABORTED" || message === "request aborted";
}
