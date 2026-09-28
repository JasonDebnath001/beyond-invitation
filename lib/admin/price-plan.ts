import {
  normalise,
  type ImportPlan,
  type ItemRecord,
  type ParsedItems,
  type PlannedRow,
} from "./item-fields";
import { planItemImport, type ItemContext } from "./item-plan";

/** Accept the storefront design number or internal item code within the company. */
export function planPriceImport(
  parsed: ParsedItems,
  context: ItemContext,
): ImportPlan {
  const identifiers = new Map<string, ItemRecord[]>();
  for (const item of context.items) {
    if (item.company_id !== context.companyId) continue;
    for (const key of new Set([normalise(item.code), normalise(item.name)])) {
      if (key) identifiers.set(key, [...(identifiers.get(key) ?? []), item]);
    }
  }
  const counts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  const inputs = parsed.rows.map((input) => {
    const code = normalise(input.values.code);
    counts.set(code, (counts.get(code) ?? 0) + 1);
    const matches = identifiers.get(code) ?? [];
    const existing = matches.length === 1 ? matches[0] : undefined;
    if (existing) itemCounts.set(existing.id, (itemCounts.get(existing.id) ?? 0) + 1);
    return { input, matches, existing };
  });
  const rows: PlannedRow[] = inputs.map(({ input, matches, existing }) => {
    const code = input.values.code ?? "";
    const errors = [...input.errors];
    if (!code || code === "[clear]") errors.push("Item Code is required.");
    else if (matches.length === 0)
      errors.push(`No item code or design number matches ${code} in the selected company. Check the identifier and Company selection.`);
    else if (matches.length > 1)
      errors.push(
        "More than one item matches this code or design number. Use an identifier that matches only one item.",
      );
    if ((counts.get(normalise(code)) ?? 0) > 1)
      errors.push(
        "Duplicate item code in this upload. Keep one row per item code.",
      );
    else if (existing && (itemCounts.get(existing.id) ?? 0) > 1)
      errors.push("This item appears more than once, using its item code and design number. Keep one row per product.");
    const matchedItem = existing ? { code: existing.code, designNo: existing.name } : undefined;
    if (errors.length || !existing)
      return {
        row: input.row,
        designNo: code,
        id: existing?.id ?? "",
        status: "invalid",
        changes: [],
        errors,
        patch: {},
        lookups: [],
        expectedUpdatedAt: existing?.updated_at,
        ...(matchedItem ? { matchedItem } : {}),
      };
    // Use the shared validation and optimistic write path, with only this matched item.
    const values: Record<string, string> = {
      id: existing.id,
      name: existing.name,
    };
    for (const key of ["sale_price", "mrp"])
      if (Object.hasOwn(input.values, key)) values[key] = input.values[key];
    const plan = planItemImport(
      { rows: [{ ...input, values }], headers: [], warnings: [] },
      { ...context, items: [existing] },
      false,
    );
    return { ...plan.rows[0], designNo: code, matchedItem };
  });
  const totals = { create: 0, update: 0, unchanged: 0, invalid: 0 };
  for (const row of rows) totals[row.status]++;
  return {
    rows,
    companyId: context.companyId,
    counts: totals,
    warnings: parsed.warnings,
    lookups: [],
  };
}
