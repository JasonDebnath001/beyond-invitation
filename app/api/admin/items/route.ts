import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  adminData,
  commitItemPlan,
  loadItemContext,
  loadItemLibrary,
} from "@/lib/admin/item-service";
import {
  ItemCreateError,
  parseNewItemRequest,
  planNewItem,
} from "@/lib/admin/item-create";
import { parseItemEditRequest, planItemEdit } from "@/lib/admin/item-edit";
import { readItemRequest } from "@/lib/admin/item-request";
import { ITEM_FIELDS } from "@/lib/admin/item-fields";
import {
  prepareItemPhoto,
  storeItemPhoto,
  discardItemPhoto,
} from "@/lib/admin/item-photo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};
export async function GET(request: NextRequest) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12000)]);
  try {
    const companyId =
      request.nextUrl.searchParams.get("companyId") || undefined;
    const view = request.nextUrl.searchParams.get("view");
    if (view !== "editor" && view !== "export")
      return NextResponse.json(await loadItemLibrary(companyId, signal), {
        headers,
      });
    const itemId = request.nextUrl.searchParams.get("itemId") || undefined;
    const { companies, context } = await loadItemContext(
      companyId,
      view === "editor" && !!itemId,
      {
        signal,
        editor: view === "editor",
        itemId: view === "editor" ? itemId : undefined,
      },
    );
    if (
      view === "editor" &&
      itemId &&
      !context.items.some((item) => item.id === itemId)
    )
      return NextResponse.json(
        { error: "This item is no longer available. Refresh the library." },
        { status: 404, headers },
      );
    const result = adminData(companies, context);
    if (view === "export")
      return NextResponse.json(
        {
          rows: [
            ITEM_FIELDS.map((field) => field.label),
            ...result.items.map((item) =>
              ITEM_FIELDS.map((field) => item.fields[field.label]),
            ),
          ],
        },
        { headers },
      );
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: signal.aborted
          ? "The catalogue took too long to respond. Please retry."
          : (error as Error).message,
      },
      { status: signal.aborted ? 504 : 503, headers },
    );
  }
}

export async function POST(request: NextRequest) {
  // Same CSRF boundary as imports; admin authentication is intentionally deferred.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open the dashboard on this site to add products." },
      { status: 403, headers },
    );
  try {
    const { body, photo } = await readItemRequest(request);
    const { companyId, values } = parseNewItemRequest(body);
    const { context } = await loadItemContext(companyId);
    const plan = planNewItem(values, context);
    if (photo) {
      const uploaded = await storeItemPhoto(
        await prepareItemPhoto(photo),
        companyId,
        plan.rows[0].id,
      );
      plan.rows[0].patch.image_url = uploaded.url;
      plan.rows[0].patch.thumb_url = uploaded.url;
    }
    const result = await commitItemPlan(plan);
    if (result.created !== 1) {
      const message =
        result.rows[0]?.message ??
        "Could not add the product. Please try again.";
      if (/duplicate|created after preview/i.test(message))
        throw new ItemCreateError(
          "This design number or item code was just added. Refresh the item library before trying again.",
          409,
        );
      throw new Error(message);
    }
    try {
      revalidateTag("catalogue");
      revalidatePath("/", "layout");
    } catch {
      /* The catalogue's existing expiry remains a fallback after a successful write. */
    }
    return NextResponse.json(
      { id: plan.rows[0].id, designNo: plan.rows[0].designNo },
      { status: 201, headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
        issues: error instanceof ItemCreateError ? error.issues : [],
      },
      {
        status: error instanceof ItemCreateError ? error.status : 503,
        headers,
      },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Open the dashboard on this site to edit items." },
      { status: 403, headers },
    );
  try {
    const { body, photo } = await readItemRequest(request);
    const input = parseItemEditRequest(body);
    const { context } = await loadItemContext(input.companyId);
    const plan = planItemEdit(input, context);
    let uploaded: { path: string; url: string } | undefined;
    if (photo) {
      uploaded = await storeItemPhoto(
        await prepareItemPhoto(photo),
        input.companyId,
        input.id,
      );
      const row = plan.rows[0];
      row.patch.image_url = uploaded.url;
      row.patch.thumb_url = uploaded.url;
      row.status = "update";
      plan.counts = { create: 0, update: 1, unchanged: 0, invalid: 0 };
    }
    const result = await commitItemPlan(plan);
    if (!result.updated && !result.unchanged) {
      const message =
        result.rows[0]?.message ??
        "Could not save this item. Please try again.";
      if (/changed after preview/i.test(message)) {
        if (uploaded) await discardItemPhoto(uploaded.path);
        throw new ItemCreateError(
          "This item changed while you were saving. Close the editor, refresh the library and reopen it before saving.",
          409,
        );
      }
      throw new Error(message);
    }
    if (result.updated) {
      try {
        revalidateTag("catalogue");
        revalidatePath("/", "layout");
      } catch {
        /* Existing cache expiry remains a fallback after successful writes. */
      }
    }
    return NextResponse.json(
      { id: input.id, designNo: plan.rows[0].designNo },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
        issues: error instanceof ItemCreateError ? error.issues : [],
      },
      {
        status: error instanceof ItemCreateError ? error.status : 503,
        headers,
      },
    );
  }
}
