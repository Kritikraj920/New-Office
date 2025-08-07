// backend/services/pdr1/processors/common/RowMappingUtils.ts

export interface RowMappingError {
  row?: number;
  column?: number;
  message: string;
}

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')       // Replace line breaks, tabs
    .replace(/[^a-z0-9\s]/gi, '')    // Remove special characters
    .replace(/\s+/g, ' ')            // Collapse multiple spaces
    .trim();
}

export function mapRowToRecord(
  headers: string[],
  row: any[],
  rowIndex: number,
  columnMapping: Record<string, string>,
  requiredFields: string[],
  errors: RowMappingError[]
): any | null {
  const record: any = {};

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);
    const dbColumn = columnMapping[normalizedHeader];

    if (!dbColumn) {
      errors.push({
        row: rowIndex + 1,
        column: index + 1,
        message: `Unmapped header "${header}" at column ${index + 1}`
      });
      return;
    }

    record[dbColumn] = row[index];
  });

  const isMissingRequired = requiredFields.some(field => !record[field]);
  if (isMissingRequired) {
    errors.push({
      row: rowIndex + 1,
      message: `Missing required fields: ${requiredFields.filter(f => !record[f]).join(', ')}`
    });
    return null;
  }

  return record;
}
