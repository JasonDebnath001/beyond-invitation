import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  ALL_ITEM_FIELDS,
  normalise,
  type Company,
  type ItemRecord,
  type Lookup,
  type AdminData,
  type ImportPlan,
  type ImportResult,
} from "./item-fields";
import type { ItemContext } from "./item-plan";

const ITEM_SELECT = [
  ...new Set([
    "id",
    "company_id",
    "updated_at",
    "stock_uom", "purchase_uom", "sale_uom", "ke_bharat_name", "tax_category",
    ...ALL_ITEM_FIELDS.map((field) => field.key),
  ]),
].join(",");

async function readAll(
  db: SupabaseClient,
  table: string,
  select: string,
  companyId?: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let query = db
      .from(table)
      .select(select)
      .order("id")
      .range(from, from + 999);
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = await query;
    if (error) throw new Error(`Cannot read ${table}: ${error.message}`);
    const page = (data ?? []) as unknown as Record<string, unknown>[]; 
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
  throw new Error(
    `Too many ${table} records to load. Narrow the company scope.`,
  );
}

export async function loadItemContext(
  requestedCompany?: string,
): Promise<{ companies: Company[]; context: ItemContext }> {
  const db = getSupabaseAdminClient();
  const { data, error } = await db
    .from("companies")
    .select("id,name,is_shared")
    .eq("is_active", true)
    .order("name");
  if (error) throw new Error(`Cannot load companies: ${error.message}`);
  const companies = (data ?? []) as Company[];
  const company = requestedCompany
    ? companies.find((company) => company.id === requestedCompany)
    : (companies.find((company) => company.is_shared) ?? companies[0]);
  if (!company) throw new Error("Select an active company.");
  const tables = [
    ...new Set(
      ALL_ITEM_FIELDS.map((field) => field.table).filter(
        (table): table is string => !!table && table !== "items",
      ),
    ),
  ];
  const results = await Promise.allSettled([
    readAll(db, "items", ITEM_SELECT, company.id),
    ...tables.map((table) =>
      readAll(
        db,
        table,
        `id,name,company_id,is_active${table === "uoms" ? ",symbol" : table === "price_lists" ? ",list_type" : ""}`,
      ),
    ),
  ]);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  const values = results.map(
    (result) =>
      (result as PromiseFulfilledResult<Record<string, unknown>[]>).value,
  );
  return {
    companies,
    context: {
      companyId: company.id,
      sharedCompanyIds: companies
        .filter((company) => company.is_shared)
        .map((company) => company.id),
      items: values[0] as ItemRecord[],
      lookups: Object.fromEntries(
        tables.map((table, index) => [table, values[index + 1] as Lookup[]]),
      ),
    },
  };
}

export function adminData(
  companies: Company[],
  context: ItemContext,
): AdminData {
  const label = (field: (typeof ALL_ITEM_FIELDS)[number], value: unknown) => {
    if (!field.table || value == null) return value;
    return (
      (field.table === "items"
        ? context.items
        : (context.lookups[field.table] ?? [])
      ).find((row) => row.id === value)?.name ?? value
    );
  };
  return {
    companies,
    companyId: context.companyId,
    items: [...context.items]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((item) => {
        const fields = Object.fromEntries(
          ALL_ITEM_FIELDS.map((field) => [
            field.label,
            field.kind === "disable"
              ? !item[field.key]
              : (label(field, item[field.key]) ?? null),
          ]),
        );
        return {
          id: item.id,
          designNo: item.name,
          code: item.code,
          printName: String(item.print_name ?? ""),
          category: String(fields["Item Category"] ?? ""),
          subject: String(fields.Subject ?? ""),
          visible: item.show_on_website === true,
          active: item.is_active === true,
          description: String(item.web_description || item.description || ""),
          updatedAt: item.updated_at,
          fields,
        };
      }),
  };
}

function signingKey() {
  const secret =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret)
    throw new Error(
      "Configure the server-only Supabase key to use item imports.",
    );
  return secret;
}
function digest(plan: ImportPlan, fileHash: string) {
  return createHmac("sha256", signingKey())
    .update(JSON.stringify({ plan, fileHash }))
    .digest("hex");
}
export function signPreview(
  plan: ImportPlan,
  fileHash: string,
  now = Date.now(),
) {
  const payload = Buffer.from(
    JSON.stringify({
      digest: digest(plan, fileHash),
      expires: now + 30 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", signingKey())
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyPreview(
  token: string,
  plan: ImportPlan,
  fileHash: string,
  now = Date.now(),
) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra)
    throw new Error("Preview this file before importing.");
  const expected = createHmac("sha256", signingKey()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    throw new Error("Preview this file again before importing.");
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (state.expires < now)
    throw new Error("The preview expired. Preview the file again.");
  if (state.digest !== digest(plan, fileHash))
    throw new Error(
      "The file or item data changed since preview. Preview again to see the latest changes.",
    );
}

/** Each item write is conditional. Completed rows remain committed if another row fails. */
export async function commitItemPlan(
  plan: ImportPlan,
  db = getSupabaseAdminClient(),
): Promise<ImportResult> {
  const result: ImportResult = {
    rows: [],
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  };
  const resolvedReferences = new Map<string, string>();
  for (const row of plan.rows) {
    if (row.status === "invalid" || row.status === "unchanged") {
      const status = row.status === "invalid" ? "skipped" : "unchanged";
      result[status]++;
      result.rows.push({
        row: row.row,
        designNo: row.designNo,
        status,
        message: row.errors.join(" "),
      });
      continue;
    }
    try {
      const patch = { ...row.patch };
      for (const reference of row.lookups) {
        let refId = resolvedReferences.get(reference.id);
        if (!refId) {
          const { table, ...record } = reference;
          const { data: existing, error: readError } = await db
            .from(table)
            .select("id,name,is_active")
            .eq("company_id", plan.companyId)
            .ilike("name", reference.name.replace(/[%_\\]/g, "\\$&"));
          if (readError) throw new Error(readError.message);
          const matches = (existing ?? []).filter(
            (candidate) =>
              normalise(candidate.name) === normalise(reference.name),
          );
          if (
            matches.length > 1 ||
            matches.some((candidate) => candidate.is_active === false)
          )
            throw new Error(
              `The reference ${reference.name} changed. Preview again.`,
            );
          if (matches.length) refId = matches[0].id;
          else {
            const { error } = await db
              .from(table)
              .upsert(
                { ...record, is_active: true },
                { onConflict: "id", ignoreDuplicates: true },
              );
            if (error) throw new Error(`${reference.name}: ${error.message}`);
            refId = reference.id;
          }
          resolvedReferences.set(reference.id, refId!);
        }
        for (const key of Object.keys(patch))
          if (patch[key] === reference.id) patch[key] = refId;
      }
      patch.updated_at = new Date().toISOString();
      if (row.status === "create") {
        // Recheck identity immediately before insertion; stable IDs also prevent importer races.
        const { data: matches, error: readError } = await db
          .from("items")
          .select("id,name")
          .eq("company_id", plan.companyId)
          .ilike("name", row.designNo.replace(/[%_\\]/g, "\\$&"));
        if (readError) throw new Error(readError.message);
        if (matches?.length)
          throw new Error(
            "This design was created after preview. Preview again.",
          );
        const { error } = await db.from("items").insert(patch);
        if (error) throw new Error(error.message);
        result.created++;
        result.rows.push({
          row: row.row,
          designNo: row.designNo,
          status: "created",
        });
      } else {
        const { data, error } = await db
          .from("items")
          .update(patch)
          .eq("id", row.id)
          .eq("company_id", plan.companyId)
          .eq("updated_at", row.expectedUpdatedAt!)
          .select("id");
        if (error) throw new Error(error.message);
        if (data?.length !== 1)
          throw new Error("The item changed after preview. Preview again.");
        result.updated++;
        result.rows.push({
          row: row.row,
          designNo: row.designNo,
          status: "updated",
        });
      }
    } catch (error) {
      result.failed++;
      result.rows.push({
        row: row.row,
        designNo: row.designNo,
        status: "failed",
        message: (error as Error).message,
      });
    }
  }
  return result;
}
