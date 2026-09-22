import { ALL_ITEM_FIELDS } from "./item-fields";
import { ItemCreateError } from "./item-create";
import { planItemImport, type ItemContext } from "./item-plan";

export function parseItemEditRequest(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ItemCreateError("Choose an item to edit.");
  const {
    companyId,
    id,
    expectedUpdatedAt,
    values: input,
  } = body as Record<string, unknown>;
  if (
    typeof companyId !== "string" ||
    !companyId.trim() ||
    companyId.length > 200 ||
    typeof id !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(id) ||
    typeof expectedUpdatedAt !== "string" ||
    expectedUpdatedAt.length > 100 ||
    Number.isNaN(Date.parse(expectedUpdatedAt))
  )
    throw new ItemCreateError(
      "Refresh the item library and open the item again.",
    );
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ItemCreateError("Enter the details you want to update.");
  const fields = new Map(
    ALL_ITEM_FIELDS.filter((field) => !["id", "name"].includes(field.key)).map(
      (field) => [field.key, field],
    ),
  );
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (!field)
      throw new ItemCreateError(`This field cannot be edited: ${key}.`);
    if (typeof value !== "string")
      throw new ItemCreateError(`${field.label}: enter a text value.`);
    const text = value.trim();
    if (text.length > (key.includes("description") ? 30000 : 2000))
      throw new ItemCreateError(`${field.label}: value is too long.`);
    // Only explicitly changed fields arrive here. Blank clears an optional value.
    values[key] = text || "[clear]";
  }
  return { companyId: companyId.trim(), id, expectedUpdatedAt, values };
}

export function planItemEdit(
  input: ReturnType<typeof parseItemEditRequest>,
  context: ItemContext,
) {
  const existing = context.items.find(
    (item) => item.id === input.id && item.company_id === input.companyId,
  );
  if (!existing)
    throw new ItemCreateError(
      "This item is no longer available in the selected company.",
      404,
    );
  if (existing.updated_at !== input.expectedUpdatedAt)
    throw new ItemCreateError(
      "This item changed since you opened it. Close the editor, refresh the library and reopen it before saving.",
      409,
    );
  const plan = planItemImport(
    {
      rows: [
        {
          row: 1,
          values: { ...input.values, id: existing.id, name: existing.name },
          errors: [],
        },
      ],
      warnings: [],
      headers: [],
    },
    context,
    false,
  );
  const row = plan.rows[0];
  if (row.status === "invalid")
    throw new ItemCreateError("Check the item details below.", 400, row.errors);
  if (row.status !== "update" && row.status !== "unchanged")
    throw new ItemCreateError("Refresh the item library before saving.", 409);
  return plan;
}
