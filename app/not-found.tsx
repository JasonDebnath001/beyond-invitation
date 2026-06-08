import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gold">
          404
        </p>

        <h1 className="mt-4 font-serif text-4xl font-semibold text-maroon">
          Page not found
        </h1>

        <p className="mt-3 text-sm leading-6 text-ink-light">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-maroon px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-dark"
          >
            Go Home
          </Link>

          <Link
            href="/collections/wedding-card"
            className="rounded-full border border-carbon px-5 py-2.5 text-sm font-semibold text-carbon transition hover:bg-carbon hover:text-white"
          >
            View Cards
          </Link>
        </div>
      </div>
    </main>
  );
}