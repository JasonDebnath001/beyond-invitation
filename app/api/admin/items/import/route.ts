import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { MAX_IMPORT_BYTES } from "@/lib/admin/item-fields";
import { parseItemUpload } from "@/lib/admin/item-upload";
import { planItemImport } from "@/lib/admin/item-plan";
import { commitItemPlan, loadItemContext, signPreview, verifyPreview } from "@/lib/admin/item-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: NextRequest) {
  // This is a CSRF check, not admin authentication. Authentication is intentionally deferred.
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Open the dashboard on this site to import items." }, { status: 403, headers });
  if (Number(request.headers.get("content-length")) > MAX_IMPORT_BYTES + 256 * 1024) return NextResponse.json({ error: "Upload a file up to 4 MB." }, { status: 413, headers });
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Upload a CSV or XLSX file." }, { status: 400, headers }); }
  const file = form.get("file");
  const companyId = String(form.get("companyId") ?? "");
  const action = String(form.get("action") ?? "preview");
  if (!(file instanceof File) || !companyId || !["preview", "commit"].includes(action)) return NextResponse.json({ error: "Choose a company and an item file." }, { status: 400, headers });
  if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ error: "Upload a file up to 4 MB." }, { status: 413, headers });
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const parsed = await parseItemUpload(bytes, file.name);
    const { context } = await loadItemContext(companyId);
    const plan = planItemImport(parsed, context, form.get("createMissing") === "true");
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    if (action === "preview") return NextResponse.json({ plan, token: signPreview(plan, fileHash), columns: parsed.headers }, { headers });
    try { verifyPreview(String(form.get("token") ?? ""), plan, fileHash); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 409, headers }); }
    const result = await commitItemPlan(plan);
    if (result.created || result.updated) {
      try { revalidateTag("catalogue"); revalidatePath("/", "layout"); }
      catch { /* Writes succeeded; the catalogue's existing 60-second expiry remains a fallback. */ }
    }
    return NextResponse.json({ result }, { headers });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400, headers });
  }
}
