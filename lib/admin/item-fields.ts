export type FieldKind =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "reference"
  | "disable";
export type ItemField = {
  label: string;
  key: string;
  kind: FieldKind;
  table?: string;
  aliases?: string[];
  requiredForNew?: boolean;
};
const field = (
  label: string,
  key: string,
  kind: FieldKind = "text",
  extra: Partial<ItemField> = {},
): ItemField => ({ label, key, kind, ...extra });
const ref = (
  label: string,
  key: string,
  table: string,
  extra: Partial<ItemField> = {},
) => field(label, key, "reference", { table, ...extra });

/** Columns from Item_Template.xlsx, in the supplied order. */
export const ITEM_FIELDS: ItemField[] = [
  field("Record ID (blank = new)", "id", "text", { aliases: ["Record ID"] }),
  field("Item Name", "name", "text", {
    aliases: ["Design No", "Design Number", "design_no"],
  }),
  field("Code", "code", "text", { aliases: ["Item Code"] }),
  field("Print Name", "print_name"),
  ref("Item Group *", "group_id", "item_groups", { requiredForNew: true }),
  ref("Brand", "brand_id", "brands"),
  field("Item Type *", "item_type", "text", { requiredForNew: true }),
  field("Item Status", "item_status"),
  ref("Item Category", "item_category_id", "item_categories"),
  field("Has Variants (Template)? (Y/N)", "has_variants", "boolean", {
    aliases: ["Has Variants"],
  }),
  ref("Variant Of (Template)", "variant_of", "items", {
    aliases: ["Variant Of"],
  }),
  field("Allow Mfg.", "allow_manufacturing", "boolean"),
  field("Allow Sales", "allow_sales", "boolean"),
  field("Allow Purchase", "allow_purchase", "boolean"),
  field("Allow Negative Stock", "allow_negative_stock", "boolean"),
  field("Maintain Stock", "maintain_stock", "boolean"),
  field("Carton Apply", "carton_apply", "boolean"),
  field("Apply Rack", "rack_apply", "boolean"),
  ref("Subject", "subject_id", "subjects"),
  ref("Season", "season_id", "seasons"),
  field("Year", "year", "integer"),
  field("Series", "series"),
  field("Opening Stock Qty", "opening_stock_qty", "number"),
  field("Opening Stock Value", "opening_stock_value", "number"),
  field("Valuation Method", "valuation_method"),
  field("Description", "description"),
  field("Item Description (Web)", "web_description", "text", {
    aliases: ["Web Description"],
  }),
  ref("Website Price List", "website_price_list_id", "price_lists"),
  field("Height (Cm)", "item_height", "number"),
  field("Width (Cm)", "item_width", "number"),
  field("Weight (Grams)", "weight_per_unit", "number"),
  field("Offer %", "offer_pct", "number"),
  field("Offer Upto", "offer_upto", "date"),
  field("Stock Status", "stock_status"),
  field("Expected Date", "stock_expected_date", "date"),
  field("Minimum Order Qty", "min_order_qty", "integer"),
  field("Order Multiple of", "order_multiple", "integer"),
  field("Video Type", "video_source"),
  field("Video / YouTube Link", "video_url"),
  field("HSN / SAC", "hsn_sac"),
  ref("Tax Category", "gst_rate_tax_category_id", "tax_categories"),
  ref("Default Supplier", "default_supplier_id", "suppliers"),
  field("Original No", "original_no"),
  field("Show on Website", "show_on_website", "boolean"),
  ref("Primary UOM", "primary_uom_id", "uoms"),
  ref("Purchase UOM", "purchase_uom_id", "uoms"),
  ref("Sales UOM", "sales_uom_id", "uoms"),
  field("Cost / Last Purchase", "cost_last_purchase", "number"),
  ref("KE / Bharat Name", "ke_bharat_id", "kebharats"),
  ref("Samples Set Category", "samples_set_category_id", "sample_categories"),
  field("Is Package Item", "is_package_item", "boolean"),
  field("Disable", "is_active", "disable"),
];

export const EXTRA_FIELDS: ItemField[] = [
  field("Image URL", "image_url"),
  field("Thumbnail URL", "thumb_url"),
];
export const ALL_ITEM_FIELDS = [...ITEM_FIELDS, ...EXTRA_FIELDS];
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const normalise = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("en");
export const headerKey = (value: unknown) =>
  normalise(value).replace(/[^a-z0-9]/g, "");

export type ItemRecord = {
  id: string;
  name: string;
  code: string;
  company_id: string;
  updated_at: string;
  [key: string]: unknown;
};
export type Lookup = {
  id: string;
  name: string;
  company_id?: string | null;
  is_active?: boolean;
  symbol?: string;
  has_variants?: boolean;
  list_type?: string;
  [key: string]: unknown;
};
export type Company = { id: string; name: string; is_shared: boolean };
export type ImportRow = {
  row: number;
  values: Record<string, string>;
  errors: string[];
};
export type ParsedItems = {
  rows: ImportRow[];
  warnings: string[];
  headers: string[];
};
export type FieldChange = {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
};
export type PlannedLookup = {
  id: string;
  table: string;
  name: string;
  company_id: string;
  code?: string;
};
export type PlannedRow = {
  row: number;
  designNo: string;
  id: string;
  status: "create" | "update" | "unchanged" | "invalid";
  changes: FieldChange[];
  errors: string[];
  patch: Record<string, unknown>;
  expectedUpdatedAt?: string;
  lookups: PlannedLookup[];
};
export type ImportPlan = {
  rows: PlannedRow[];
  warnings: string[];
  counts: Record<PlannedRow["status"], number>;
  lookups: PlannedLookup[];
  companyId: string;
};
export type ImportResult = {
  rows: {
    row: number;
    designNo: string;
    status: "created" | "updated" | "unchanged" | "skipped" | "failed";
    message?: string;
  }[];
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
};
export type AdminItem = {
  id: string;
  designNo: string;
  code: string;
  printName: string;
  category: string;
  subject: string;
  visible: boolean;
  active: boolean;
  description: string;
  updatedAt: string;
  fields: Record<string, unknown>;
  values: Record<string, string>;
  images: string[];
};
export type AdminData = {
  companies: Company[];
  companyId: string;
  items: AdminItem[];
  referenceOptions: Record<
    string,
    { id: string; name: string; shared: boolean }[]
  >;
  itemTypes: string[];
};

export type AdminLibraryItem = Pick<AdminItem, "id" | "designNo" | "code" | "printName" | "category" | "subject" | "visible" | "active" | "updatedAt"> & {
  imageUrl: string;
  hasDescription: boolean;
};
export type AdminLibraryData = {
  companies: Company[];
  companyId: string;
  items: AdminLibraryItem[];
};

export const NEW_ITEM_DEFAULTS: Record<string, string> = {
  show_on_website: "N",
  is_active: "N", // The field uses the template's Disable semantics.
  allow_sales: "Y",
  min_order_qty: "1",
  order_multiple: "1",
};

export const MAX_PRODUCT_PHOTO_BYTES = 3 * 1024 * 1024;
// Original files are resized in the browser before reaching the upload endpoint.
export const MAX_PRODUCT_PHOTO_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_PRODUCT_PHOTOS = 20;

export type ItemImageRecord = {
  id: string;
  item_id: string;
  image_url: string;
  sort_order: number | null;
  created_at: string;
  is_deleted: boolean;
};
