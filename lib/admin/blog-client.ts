export async function blogRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "The request failed. Please retry.");
    return body as T;
  } catch (error) {
    if (timeout.aborted) throw new Error("The request took too long. Your text is still here; please retry.");
    if (error instanceof SyntaxError) throw new Error("The server returned an incomplete response. Please retry.");
    throw error;
  }
}
