/** Shared across pages: at most eight loads, one cached result per URL. */
export function createPdfPhotoPool<T>(
  load: (url: string, signal: AbortSignal) => Promise<T>,
  parentSignal?: AbortSignal,
) {
  const controller = new AbortController();
  type Task = { url: string; promise: Promise<T | null>; resolve: (value: T | null) => void };
  const cache = new Map<string, Task>();
  const queue: Task[] = [];
  let active = 0;
  let closed = false;
  function dispose() {
    if (closed) return;
    closed = true;
    controller.abort();
    parentSignal?.removeEventListener("abort", dispose);
    queue.length = 0;
    // Settle callers promptly even if a browser decode is still finishing.
    cache.forEach((task) => task.resolve(null));
  }
  function pump() {
    while (!closed && active < 8 && queue.length) {
      const task = queue.shift()!;
      active++;
      void Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("PDF download cancelled.");
        return load(task.url, controller.signal);
      }).then(task.resolve, () => task.resolve(null)).finally(() => {
        active--;
        pump();
      });
    }
  }
  parentSignal?.addEventListener("abort", dispose, { once: true });
  if (parentSignal?.aborted) dispose();
  return {
    get(url: string): Promise<T | null> {
      if (closed) return Promise.resolve(null);
      const existing = cache.get(url);
      if (existing) return existing.promise;
      let resolve!: Task["resolve"];
      const promise = new Promise<T | null>((done) => { resolve = done; });
      const task = { url, promise, resolve };
      cache.set(url, task);
      queue.push(task);
      pump();
      return promise;
    },
    dispose,
  };
}
