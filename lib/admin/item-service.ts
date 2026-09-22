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
  type ItemImageRecord,
  type AdminLibraryData,
} from "./item-fields";
import type { ItemContext } from "./item-plan";

const ITEM_SELECT = [
  ...new Set([
    "id",
    "company_id",
    "updated_at",
    "stock_uom",
    "purchase_uom",
    "sale_uom",
    "ke_bharat_name",
    "tax_category",
    ...ALL_ITEM_FIELDS.map((field) => field.key),
  ]),
].join(",");

async function readAll(
  db: SupabaseClient,
  table: string,
  select: string,
  companyId?: string,
  options: { signal?: AbortSignal; match?: [string, string | boolean] } = {},
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    let query = db
      .from(table)
      .select(select)
      .order("id")
      .range(from, from + 999);
    if (companyId) query = query.eq("company_id", companyId);
    if (table === "item_images") query = query.eq("is_deleted", false);
    if (options.match) query = query.eq(...options.match);
    if (options.signal) query = query.abortSignal(options.signal);
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
  includeImages = false,
  options: { signal?: AbortSignal; editor?: boolean; itemId?: string } = {},
): Promise<{ companies: Company[]; context: ItemContext }> {
  const db = getSupabaseAdminClient();
  let companyQuery = db
    .from("companies")
    .select("id,name,is_shared")
    .eq("is_active", true)
    .order("name");
  if (options.signal) companyQuery = companyQuery.abortSignal(options.signal);
  const { data, error } = await companyQuery;
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
    options.editor && !options.itemId
      ? Promise.resolve([])
      : readAll(db, "items", ITEM_SELECT, company.id, {
          signal: options.signal,
          ...(options.itemId ? { match: ["id", options.itemId] as [string, string] } : {}),
        }),
    ...tables.map((table) =>
      readAll(
        db,
        table,
        `id,name,company_id,is_active${table === "uoms" ? ",symbol" : table === "price_lists" ? ",list_type" : ""}`,
        undefined,
        { signal: options.signal },
      ),
    ),
    includeImages
      ? readAll(db, "item_images", "id,item_id,image_url,sort_order,created_at,is_deleted", company.id, {
          signal: options.signal,
          ...(options.itemId ? { match: ["item_id", options.itemId] as [string, string] } : {}),
        })
      : Promise.resolve([]),
    // Small reference rows preserve variant labels and item-type suggestions.
    options.editor
      ? readAll(db, "items", "id,name,company_id,is_active,has_variants,item_type", company.id, { signal: options.signal })
      : Promise.resolve([]),
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
      images: includeImages ? (values[tables.length + 1] as ItemImageRecord[]) : [],
      lookups: Object.fromEntries(
        [
          ...tables.map((table, index) => [table, values[index + 1] as Lookup[]]),
          ...(options.editor ? [["items", values[tables.length + 2] as Lookup[]]] : []),
        ],
      ),
    },
  };
}

/** The library needs three tables; editor references and galleries load on demand. */
export async function loadItemLibrary(
  requestedCompany?: string,
  signal?: AbortSignal,
): Promise<AdminLibraryData> {
  const db = getSupabaseAdminClient();
  let query = db
    .from("companies")
    .select("id,name,is_shared")
    .eq("is_active", true)
    .order("name");
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) throw new Error(`Cannot load companies: ${error.message}`);
  const companies = (data ?? []) as Company[];
  const company = requestedCompany
    ? companies.find((entry) => entry.id === requestedCompany)
    : companies.find((entry) => entry.is_shared) ?? companies[0];
  if (!company) throw new Error("Select an active company.");
  const [items, categories, subjects] = await Promise.all([
    readAll(
      db,
      "items",
      "id,name,code,print_name,item_category_id,subject_id,is_active,show_on_website,image_url,description,web_description,updated_at",
      company.id,
      { signal },
    ),
    readAll(db, "item_categories", "id,name", undefined, { signal }),
    readAll(db, "subjects", "id,name", undefined, { signal }),
  ]);
  const categoryNames = new Map(
    categories.map((entry) => [entry.id, String(entry.name ?? "")]),
  );
  const subjectNames = new Map(
    subjects.map((entry) => [entry.id, String(entry.name ?? "")]),
  );
  return {
    companies,
    companyId: company.id,
    items: items
      .map((item) => ({
        id: String(item.id),
        designNo: String(item.name ?? ""),
        code: String(item.code ?? ""),
        printName: String(item.print_name ?? ""),
        category: categoryNames.get(item.item_category_id) ?? "",
        subject: subjectNames.get(item.subject_id) ?? "",
        visible: item.show_on_website === true,
        active: item.is_active === true,
        imageUrl: String(item.image_url ?? ""),
        hasDescription: !!(item.web_description || item.description),
        updatedAt: String(item.updated_at ?? ""),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
        ? context.lookups.items ?? context.items
        : (context.lookups[field.table] ?? [])
      ).find((row) => row.id === value)?.name ?? value
    );
  };
  return {
    companies,
    companyId: context.companyId,
    referenceOptions: Object.fromEntries(
      [
        ...new Set(
          ALL_ITEM_FIELDS.flatMap((field) =>
            field.table ? [field.table] : [],
          ),
        ),
      ].map((table) => [
        table,
        (table === "items" ? context.lookups.items ?? context.items : (context.lookups[table] ?? []))
          .filter(
            (row) =>
              row.is_active !== false &&
              (!row.company_id ||
                row.company_id === context.companyId ||
                (table !== "items" &&
                  context.sharedCompanyIds.includes(row.company_id))) &&
              (table !== "items" || row.has_variants === true) &&
              (table !== "price_lists" || row.list_type === "Selling"),
          )
          .map((row) => ({
            id: row.id,
            name: row.name,
            shared: !!row.company_id && row.company_id !== context.companyId,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ]),
    ),
    itemTypes: [
      ...new Set(
        (context.lookups.items ?? context.items)
          .map((item) => String(item.item_type ?? ""))
          .filter(Boolean),
      ),
    ].sort(),
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
          images: [...new Set([
            String(item.image_url ?? ""),
            ...(context.images ?? []).filter((image) => image.item_id === item.id && !image.is_deleted)
              .sort((a, b) => (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
              .map((image) => image.image_url),
          ].filter(Boolean))],
          fields,
          values: Object.fromEntries(
            ALL_ITEM_FIELDS.filter((field) => field.key !== "id").map(
              (field) => {
                const value = item[field.key];
                return [
                  field.key,
                  value == null
                    ? ""
                    : field.kind === "disable"
                      ? value
                        ? "N"
                        : "Y"
                      : field.kind === "boolean"
                        ? value
                          ? "Y"
                          : "N"
                        : String(value),
                ];
              },
            ),
          ),
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
