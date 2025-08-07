// backend/services/pdr1/processors/IMDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, NSE_COLUMN_MAPPING } from '../valuationTypes';
import { BaseFileProcessor } from './BaseFileProcessor';

export class NSEProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
        dateNF: 'dd-mmm-yyyy'
      });

      const sheetName = Object.keys(workbook.Sheets)[0]; // NSE has single sheet
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'dd-mmm-yyyy'
      });

      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) {
        throw new Error('Header row not found in NSE sheet');
      }

      const headers = (jsonData[headerRowIndex] as string[]).map(h =>
        h ? h.toString().toLowerCase().trim() : ''
      );

      const allRecords: any[] = [];
      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;
        const record = this.mapRowToRecord(headers, row);
        if (record) allRecords.push(record);
      }

      await this.prisma.nSE.deleteMany({});

      let processedRecords = 0;
      let errorRecords = 0;

      for (const record of allRecords) {
        try {
          const processedRecord = this.processRecord(record, batchId);
          await this.prisma.nSE.create({ data: processedRecord });
          processedRecords++;
        } catch (err) {
          console.error('Error saving NSE record:', err);
          errorRecords++;
        }
      }

      return {
        totalRecords: allRecords.length,
        processedRecords,
        errorRecords,
      };
    } catch (error) {
      console.error('Error processing NSE file:', error);
      throw error;
    }
  }

  private mapRowToRecord(headers: string[], row: any[]): any {
    // console.log(headers);
    const record: any = {};
    headers.forEach((header, idx) => {
      const dbCol = NSE_COLUMN_MAPPING[header];
      if (dbCol && row[idx] !== undefined) {
        record[dbCol] = row[idx];
      }
    });
    return record.isin ? record : null;
  }

  private processRecord(record: any, batchId: string): any {
    return {
      ...record,
      uploadBatchId: batchId,
      clspric: record.clspric ? parseFloat(record.clspric) : null,
      tradDt: this.parseDate(record.traddt),
      bizDt: this.parseDate(record.bizdt),
      SttlmPric: record.SttlmPric ? parseFloat(record.SttlmPric) : null,
    };
  }

  private findHeaderRow(data: any[]): number {
    for (let i = 0; i < Math.min(data.length, 20); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;
      const lowerRow = row.map(cell =>
        cell ? cell.toString().toLowerCase().trim() : ''
      );
      if (lowerRow.includes('isin') && lowerRow.includes('fininstrmnm')) {
        return i;
      }
    }
    return -1;
  }
}
