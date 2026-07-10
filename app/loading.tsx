export default function Loading() {
  /*
   * The fixed SiteLoader in the root layout visually covers this surface
   * during the first page load.
   */
  return <div className="min-h-[70vh] bg-paper" aria-hidden="true" />;
}
