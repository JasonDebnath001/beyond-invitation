/** A stalled request must leave the loading state, including a stalled response body. */
export async function readAdminJson(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    abort = () => {
      controller.abort();
      reject(new Error("Request cancelled."));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new Error("The catalogue took too long to respond. Please retry."),
      );
    }, 15000);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        let body;
        try {
          body = await response.json();
        } catch {
          throw new Error(
            "The catalogue returned an incomplete response. Please retry.",
          );
        }
        if (!response.ok)
          throw new Error(
            body.error || "Could not load the catalogue. Please retry.",
          );
        return body;
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}
