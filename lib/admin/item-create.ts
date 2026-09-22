import { ALL_ITEM_FIELDS, NEW_ITEM_DEFAULTS, normalise } from "./item-fields";
import { planItemImport, type ItemContext } from "./item-plan";

export class ItemCreateError extends Error {
  constructor(
    message: string,
    public status = 400,
    public issues: string[] = [],
  ) {
    super(message);
  }
}

/** Accept only item fields; record IDs and company scope are always server-owned. */
export function parseNewItemRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ItemCreateError("Enter product details and choose a company.");
  const { companyId, values: input } = body as Record<string, unknown>;
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    companyId.length > 200
  )
    throw new ItemCreateError("Choose a company.");
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ItemCreateError("Enter product details.");
  const fields = new Map(
    ALL_ITEM_FIELDS.filter((field) => field.key !== "id").map((field) => [
      field.key,
      field,
    ]),
  );
  const values = { ...NEW_ITEM_DEFAULTS };
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (!field) throw new ItemCreateError(`Unsupported product field: ${key}.`);
    if (typeof value !== "string")
      throw new ItemCreateError(`${field.label}: enter a text value.`);
    const text = value.trim();
    if (text.length > (key.includes("description") ? 30000 : 2000))
      throw new ItemCreateError(`${field.label}: value is too long.`);
    if (text === "[clear]")
      throw new ItemCreateError(`${field.label}: leave optional fields blank.`);
    if (text) values[key] = text;
  }
  return { companyId: companyId.trim(), values };
}

export function planNewItem(
  values: Record<string, string>,
  context: ItemContext,
) {
  // Import is an upsert workflow. Manual creation must never update an existing design.
  if (
    context.items.some(
      (item) => normalise(item.name) === normalise(values.name),
    )
  )
    throw new ItemCreateError(
      "A product with this design number already exists. Choose a different design number.",
      409,
    );
  if (
    values.code &&
    context.items.some(
      (item) => normalise(item.code) === normalise(values.code),
    )
  )
    throw new ItemCreateError(
      "A product with this item code already exists. Choose another code or leave it blank.",
      409,
    );
  const plan = planItemImport(
    { rows: [{ row: 1, values, errors: [] }], warnings: [], headers: [] },
    context,
    false,
  );
  const row = plan.rows[0];
  if (row.status !== "create")
    throw new ItemCreateError(
      "Check the product details below.",
      400,
      row.errors,
    );
  return plan;
}
