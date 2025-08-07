// backend/services/pdr1/processors/common/RowMappingUtils.ts

export interface RowMappingError {
  row?: number;
  column?: number;
  message: string;
}

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^a-z0-9\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps a row to a record based on the given headers and column mapping.
 * Only validates headers that are present in FIMMDA_COLUMN_MAPPING.
 */
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

    // If header is not in mapping, skip silently (no error)
    if (!dbColumn) return;

    const cellValue = row[index];
    if (cellValue === undefined || cellValue === null || cellValue === '') {
      errors.push({
        row: rowIndex + 1,
        column: index + 1,
        message: `Missing value for required field "${normalizedHeader}"`
      });
    }

    record[dbColumn] = cellValue;
  });

  // Check required fields from the mapping
  const missingRequired = requiredFields.filter(f => !record[f] && record[f] !== 0);
  if (missingRequired.length > 0) {
    errors.push({
      row: rowIndex + 1,
      message: `Missing required fields: ${missingRequired.join(', ')}`
    });
    return null;
  }

  return record;
}
