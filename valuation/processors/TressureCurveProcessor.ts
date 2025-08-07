import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { T_BILL_CURVE_COLUMN_MAPPING, ProcessingResult } from '../valuationTypes';
import { BaseFileProcessor } from './BaseFileProcessor';

export class TressureCurveProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = 'T-BILL CURVE';
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) throw new Error('Header row not found');

      const headers = (jsonData[headerRowIndex] as string[]).map(h =>
        h ? h.toString().toLowerCase().trim() : ''
      );

      const allRecords: any[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        const record = this.mapRowToRecord(headers, row);
        if (record) allRecords.push(record);
      }

      await this.prisma.treasuryCurve.deleteMany({});

      let processed = 0, errors = 0;
      for (const record of allRecords) {
        try {
          const processedRecord = this.processRecord(record, batchId);
          await this.prisma.treasuryCurve.create({ data: processedRecord });
          processed++;
        } catch (err) {
          console.error('Record error:', err);
          errors++;
        }
      }

      return {
        totalRecords: allRecords.length,
        processedRecords: processed,
        errorRecords: errors
      };
    } catch (error) {
      console.error('TBillCurve processing failed:', error);
      throw error;
    }
  }

  private mapRowToRecord(headers: string[], row: any[]): any {
    const record: any = {};
    headers.forEach((header, idx) => {
      const dbCol = T_BILL_CURVE_COLUMN_MAPPING[header];
      if (dbCol && row[idx] !== undefined) {
        record[dbCol] = row[idx];
      }
    });
    return record.tenor ? record : null;
  }

  private processRecord(record: any, batchId: string): any {
    return {
      ...record,
      uploadBatchId: batchId,
      date: record.date ? new Date(record.date) : null,
      rate: record.rate ? parseFloat(record.rate) : null
    };
  }

  private findHeaderRow(data: any[]): number {
    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      const lowered = row.map(cell =>
        cell ? cell.toString().toLowerCase().trim() : ''
      );
      if (lowered.includes('tenor') && lowered.includes('rate(%)')) {
        return i;
      }
    }
    return -1;
  }
}