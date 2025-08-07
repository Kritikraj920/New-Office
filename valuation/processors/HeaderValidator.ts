import * as fs from 'fs';
import * as path from 'path';

export interface HeaderValidationResult {
  cleanedHeaders: string[];
  errors: string[];
}

export class HeaderValidator {
  static validateAndClean(headers: string[], logFilePath?: string): HeaderValidationResult {
    const errors: string[] = [];
    const seen = new Set<string>();
    const cleanedHeaders: string[] = [];

    headers.forEach((header, index) => {
      const original = header || '';
      let cleaned = original.replace(/\r|\n/g, ' ').trim(); // Remove line breaks and trim

      // Check for line breaks
      if (/\r|\n/.test(original)) {
        errors.push(`Header "${original}" at column ${index + 1} contains a line break.`);
      }

      // Check for leading/trailing spaces
      if (original !== original.trim()) {
        errors.push(`Header "${original}" at column ${index + 1} has leading/trailing spaces.`);
      }

      // Check for duplicates
      if (seen.has(cleaned.toLowerCase())) {
        errors.push(`Duplicate header found: "${cleaned}"`);
      } else {
        seen.add(cleaned.toLowerCase());
      }

      cleanedHeaders.push(cleaned);
    });

    // Optional: Log errors to file
    if (logFilePath && errors.length > 0) {
      const logContent = errors.map(e => `❌ ${e}`).join('\n');
      const fullPath = path.resolve(logFilePath);
      fs.writeFileSync(fullPath, logContent, { encoding: 'utf-8' });
    }

    return { cleanedHeaders, errors };
  }
}
