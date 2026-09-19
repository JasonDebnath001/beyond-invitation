import { createHash } from "node:crypto";
import {
  ALL_ITEM_FIELDS,
  normalise,
  type ImportPlan,
  type ItemRecord,
  type Lookup,
  type ParsedItems,
  type PlannedLookup,
  type PlannedRow,
  type ItemField,
} from "./item-fields";

export const CREATABLE_LOOKUPS = new Set([
  "item_groups",
  "item_categories",
  "brands",
  "subjects",
  "seasons",
  "kebharats",
  "sample_categories",
]);
export type ItemContext = {
  companyId: string;
  sharedCompanyIds: string[];
  items: ItemRecord[];
  lookups: Record<string, Lookup[]>;
};
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable insert IDs make retries/concurrent uploads converge on the same new record. */
export function importId(table: string, company: string, name: string) {
  const hex = createHash("sha256")
    .update(`beyond-item-import:v1:${table}:${company}:${normalise(name)}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function scalar(field: ItemField, text: string): unknown {
  if (text === "[clear]") {
    if (
      ["boolean", "disable"].includes(field.kind) ||
      ["id", "name", "code"].includes(field.key) ||
      field.requiredForNew
    )
      throw new Error("This field cannot be cleared.");
    return null;
  }
  if (field.kind === "boolean" || field.kind === "disable") {
    const value = normalise(text);
    if (!["y", "yes", "true", "1", "n", "no", "false", "0"].includes(value))
      throw new Error("Use Y or N (or true/false).");
    const yes = ["y", "yes", "true", "1"].includes(value);
    return field.kind === "disable" ? !yes : yes;
  }
  if (field.kind === "number" || field.kind === "integer") {
    if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))
      throw new Error("Enter a number without units or currency symbols.");
    const value = Number(text.replace(/,/g, ""));
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      (field.kind === "integer" && !Number.isSafeInteger(value))
    )
      throw new Error(
        "Enter a nonnegative " +
          (field.kind === "integer" ? "whole number." : "number."),
      );
    if (["min_order_qty", "order_multiple"].includes(field.key) && value < 1)
      throw new Error("Must be at least 1.");
    if (field.key === "offer_pct" && value > 100)
      throw new Error("Offer must be between 0 and 100.");
    return value;
  }
  if (field.kind === "date") {
    let iso = text;
    const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (local)
      iso = `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
      Number.isNaN(Date.parse(iso)) ||
      new Date(iso).toISOString().slice(0, 10) !== iso
    )
      throw new Error("Use a valid YYYY-MM-DD or DD/MM/YYYY date.");
    return iso;
  }
  if (text.length > (field.key.includes("description") ? 30000 : 2000))
    throw new Error("Value is too long.");
  if (["image_url", "thumb_url", "video_url"].includes(field.key)) {
    try {
      if (!["http:", "https:"].includes(new URL(text).protocol))
        throw new Error();
    } catch {
      throw new Error("Use an http or https URL.");
    }
  }
  return text;
}

export function planItemImport(
  parsed: ParsedItems,
  context: ItemContext,
  createMissing: boolean,
): ImportPlan {
  const { companyId, items, lookups } = context;
  const inputCounts = new Map<string, number>();
  for (const row of parsed.rows) {
    const key = normalise(row.values.name);
    inputCounts.set(key, (inputCounts.get(key) ?? 0) + 1);
  }
  const rows: PlannedRow[] = parsed.rows.map((input) => {
    const name = input.values.name ?? "";
    const errors = [...input.errors];
    const matches = items.filter(
      (item) => normalise(item.name) === normalise(name),
    );
    const existing = matches.length === 1 ? matches[0] : undefined;
    if (!name || name === "[clear]")
      errors.push("Item Name: a design number is required.");
    if ((inputCounts.get(normalise(name)) ?? 0) > 1)
      errors.push(
        "Duplicate design number in this upload. Keep one row per design.",
      );
    if (matches.length > 1)
      errors.push(
        "More than one existing item has this design number. Resolve the duplicates first.",
      );
    if (
      input.values.id &&
      (!uuidPattern.test(input.values.id) || input.values.id !== existing?.id)
    )
      errors.push(
        "Record ID does not match this design number. Correct it or clear it to match by Item Name.",
      );
    const codeMatches = input.values.code
      ? items.filter(
          (item) => normalise(item.code) === normalise(input.values.code),
        )
      : [];
    if (codeMatches.some((item) => item.id !== existing?.id))
      errors.push(
        `Code ${input.values.code} belongs to a different design number.`,
      );
    if (
      input.values.code &&
      parsed.rows.some(
        (other) =>
          other !== input &&
          normalise(other.values.code) === normalise(input.values.code),
      )
    )
      errors.push("Duplicate item code in this upload.");
    const id = existing?.id ?? importId("items", companyId, name);
    const patch: Record<string, unknown> = {};
    const changes: PlannedRow["changes"] = [];
    const pending: PlannedLookup[] = [];
    for (const field of ALL_ITEM_FIELDS) {
      const text = input.values[field.key];
      if (field.key === "id" || (field.key === "name" && existing)) continue;
      if (!text) {
        if (!existing && field.requiredForNew)
          errors.push(`${field.label}: required for a new item.`);
        continue;
      }
      try {
        let value = scalar(field, text);
        let before: unknown = existing?.[field.key] ?? null;
        if (field.kind === "disable" && before !== null) before = !before;
        let after: unknown = value;
        if (field.table) {
          const candidates = (
            field.table === "items" ? items : (lookups[field.table] ?? [])
          ) as Lookup[];
          const available = candidates.filter(
            (candidate) =>
              !candidate.company_id ||
              candidate.company_id === companyId ||
              (field.table !== "items" &&
                context.sharedCompanyIds.includes(candidate.company_id)),
          );
          const previous = available.find(
            (candidate) => candidate.id === before,
          );
          before = previous?.name ?? before;
          if (value !== null) {
            const found = available.filter(
              (candidate) =>
                candidate.id === text ||
                normalise(candidate.name) === normalise(text) ||
                (candidate.symbol &&
                  normalise(candidate.symbol) === normalise(text)),
            );
            const local = found.filter(
              (candidate) => candidate.company_id === companyId,
            );
            const preferred = local.length ? local : found;
            if (preferred.length > 1)
              throw new Error(
                "This name is ambiguous. Use the reference record ID.",
              );
            if (preferred.length) {
              const target = preferred[0];
              if (
                target.is_active === false &&
                existing?.[field.key] !== target.id
              )
                throw new Error("This reference is disabled.");
              if (
                field.table === "items" &&
                (!target.has_variants || target.id === id)
              )
                throw new Error(
                  "Select an existing variant template other than this item.",
                );
              if (
                field.table === "price_lists" &&
                target.list_type !== "Selling"
              )
                throw new Error("Select a Selling price list.");
              value = target.id;
              after = target.name;
            } else {
              if (
                !createMissing ||
                !CREATABLE_LOOKUPS.has(field.table) ||
                uuidPattern.test(text)
              )
                throw new Error(
                  `No matching ${field.label.replace(/ \*$/, "")} named "${text}". Choose an existing value${CREATABLE_LOOKUPS.has(field.table) ? " or enable creation of missing references" : ""}.`,
                );
              const reference: PlannedLookup = {
                id: importId(field.table, companyId, text),
                company_id: companyId,
                table: field.table,
                name: text,
              };
              if (field.table === "item_groups")
                reference.code = `WEB-${reference.id.slice(0, 8).toUpperCase()}`;
              pending.push(reference);
              value = reference.id;
              after = text;
            }
          }
          const mirrors: Record<string, string> = {
            primary_uom_id: "stock_uom",
            purchase_uom_id: "purchase_uom",
            sales_uom_id: "sale_uom",
            ke_bharat_id: "ke_bharat_name",
            gst_rate_tax_category_id: "tax_category",
          };
          if (
            mirrors[field.key] &&
            (existing?.[mirrors[field.key]] ?? null) !== after
          ) {
            patch[mirrors[field.key]] = after;
            changes.push({ field: mirrors[field.key], label: `${field.label} (stored name)`, before: existing?.[mirrors[field.key]] ?? null, after });
          }
        }
        const previous = existing?.[field.key] ?? null;
        const equal =
          previous === value ||
          ((field.kind === "number" || field.kind === "integer") &&
            previous !== null &&
            value !== null &&
            Number(previous) === value);
        if (!equal) {
          patch[field.key] = value;
          changes.push({
            field: field.key,
            label: field.label,
            before,
            after: field.kind === "disable" ? !(value as boolean) : after,
          });
        }
      } catch (error) {
        errors.push(`${field.label}: ${(error as Error).message}`);
      }
    }
    if (
      (patch.has_variants ?? existing?.has_variants) &&
      (Object.hasOwn(patch, "variant_of") ? patch.variant_of : existing?.variant_of)
    )
      errors.push(
        "An item cannot be both a variant template and a variant of another item.",
      );
    if (!existing) {
      patch.id = id;
      patch.company_id = companyId;
      if (!patch.code) {
        patch.code = `WEB-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        changes.push({
          field: "code",
          label: "Code (generated)",
          before: null,
          after: patch.code,
        });
      }
      // These live columns are NOT NULL without defaults.
      patch.variant_attributes = {};
      patch.website_tag_ids = [];
      patch.web_category_ids = [];
    }
    return {
      row: input.row,
      designNo: name,
      id,
      status: errors.length
        ? "invalid"
        : !existing
          ? "create"
          : Object.keys(patch).length
            ? "update"
            : "unchanged",
      changes,
      errors,
      patch,
      expectedUpdatedAt: existing?.updated_at,
      lookups: pending,
    };
  });
  const counts = { create: 0, update: 0, unchanged: 0, invalid: 0 };
  for (const row of rows) counts[row.status]++;
  const references = new Map(
    rows
      .filter((row) => row.status !== "invalid")
      .flatMap((row) => row.lookups)
      .map((ref) => [ref.id, ref]),
  );
  return {
    rows,
    companyId,
    counts,
    warnings: parsed.warnings,
    lookups: [...references.values()],
  };
}
