import "server-only";
import ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import {
  ALL_ITEM_FIELDS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  headerKey,
  type ParsedItems,
} from "./item-fields";

/** Only cell data is read; workbook instructions, links and formulas are never executed. */
export async function parseItemUpload(
  bytes: Buffer,
  filename: string,
): Promise<ParsedItems> {
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES)
    throw new Error("Choose a nonempty file up to 4 MB.");
  let matrix: string[][] = [];
  const cellErrors = new Map<number, string[]>();
  if (/\.csv$/i.test(filename)) {
    const text = bytes.toString("utf8");
    if (text.includes("\uFFFD"))
      throw new Error("Save your CSV as UTF-8 and upload it again.");
    matrix = parse(text, {
      bom: true,
      skip_empty_lines: false,
      relax_column_count_less: true,
      max_record_size: 200000,
    });
  } else if (/\.xlsx$/i.test(filename)) {
    // Check the ZIP directory before inflation, including hidden sheets.
    let expanded = 0;
    for (let offset = 0; offset + 46 <= bytes.length; offset++) {
      if (bytes.readUInt32LE(offset) !== 0x02014b50) continue;
      expanded += bytes.readUInt32LE(offset + 24);
      if (expanded > 32 * 1024 * 1024)
        throw new Error(
          "This workbook is too large when expanded. Export the Data sheet as CSV.",
        );
      offset +=
        45 +
        bytes.readUInt16LE(offset + 28) +
        bytes.readUInt16LE(offset + 30) +
        bytes.readUInt16LE(offset + 32);
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet =
      workbook.getWorksheet("Data") ??
      workbook.worksheets.find((sheet) => sheet.state === "visible");
    if (!sheet)
      throw new Error(
        "The workbook needs a Data sheet or a visible worksheet.",
      );
    if (sheet.actualRowCount > MAX_IMPORT_ROWS + 1 || sheet.columnCount > 150)
      throw new Error(
        "Use at most 1,000 item rows and 150 columns per upload.",
      );
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > MAX_IMPORT_ROWS + 2)
        throw new Error(
          "Remove excessive blank rows or export the Data sheet as CSV.",
        );
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        if (
          cell.type === ExcelJS.ValueType.Formula ||
          cell.type === ExcelJS.ValueType.Error
        ) {
          cellErrors.set(rowNumber, [
            ...(cellErrors.get(rowNumber) ?? []),
            `Cell ${cell.address}: replace formulas or spreadsheet errors with values.`,
          ]);
        }
        const value = cell.value;
        values[column - 1] =
          value instanceof Date
            ? value.toISOString().slice(0, 10)
            : typeof value === "number" && /^0+$/.test(cell.numFmt)
              ? String(value).padStart(cell.numFmt.length, "0")
              : cell.text;
      });
      matrix[rowNumber - 1] = values;
    });
  } else throw new Error("Upload a CSV or XLSX file.");

  if (!matrix.length) throw new Error("The file is empty.");
  const headers = matrix[0] ?? [];
  const aliases = new Map(
    ALL_ITEM_FIELDS.flatMap((field) =>
      [field.label, ...(field.kind === "disable" ? [] : [field.key]), ...(field.aliases ?? [])].map((label) => [
        headerKey(label),
        field.key,
      ]),
    ),
  );
  const used = new Set<string>();
  const warnings: string[] = [];
  const keys = Array.from({ length: headers.length }, (_, i) => {
    const label = headers[i] ?? "";
    const key = aliases.get(headerKey(label));
    if (key && used.has(key))
      throw new Error(
        `Duplicate column: ${label}. Keep only one column for each field.`,
      );
    if (key) used.add(key);
    else if (matrix.slice(1).some((row) => (row?.[i] ?? "").trim()))
      throw new Error(
        `Unsupported column ${label || i + 1} contains data. Use the item template headers.`,
      );
    else if (label.trim()) warnings.push(`Ignored empty column: ${label}`);
    return key;
  });
  if (!used.has("name"))
    throw new Error("An Item Name (design number) column is required.");
  const rows = matrix.slice(1).flatMap((cells, index) => {
    if (!cells?.some((value) => value?.trim())) return [];
    const values: Record<string, string> = {};
    keys.forEach((key, column) => {
      if (key) values[key] = (cells[column] ?? "").trim();
    });
    if (cells.slice(headers.length).some((value) => value?.trim()))
      throw new Error(`Row ${index + 2} has data beyond the header columns.`);
    return [
      { row: index + 2, values, errors: cellErrors.get(index + 2) ?? [] },
    ];
  });
  if (!rows.length || rows.length > MAX_IMPORT_ROWS)
    throw new Error("Upload between 1 and 1,000 item rows.");
  if (cellErrors.has(1))
    throw new Error("Header cells must contain plain text, not formulas.");
  return {
    rows,
    warnings,
    headers: ALL_ITEM_FIELDS.filter((field) => used.has(field.key)).map(
      (field) => field.label,
    ),
  };
}
