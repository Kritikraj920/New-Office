// backend/services/pdr1/processors/IMDealProcessor.ts

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { ProcessingResult, STRIPS_COLUMN_MAPPING } from '../valuationTypes';
import { BaseFileProcessor } from './BaseFileProcessor';

export class STRIPSProcessor extends BaseFileProcessor {
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

    const sheetsToProcess = ['strips'];
    let allRecords: any[] = [];

    // Step 1: Extract and parse both sheets
    for (const sheetNameKey of sheetsToProcess) {
      const sheetName = Object.keys(workbook.Sheets).find(
        name => name.toLowerCase() === sheetNameKey
      );

      if (!sheetName) {
        console.warn(`Sheet "${sheetNameKey}" not found.`);
        continue;
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'dd-mmm-yyyy'
      });

      const headerRowIndex = this.findHeaderRow(jsonData);
      if (headerRowIndex === -1) {
        console.warn(`Header row not found in "${sheetNameKey}" sheet.`);
        continue;
      }
//console.log(headerRowIndex)
      const headers = (jsonData[headerRowIndex] as string[]).map(h =>
        h ? h.toString().toLowerCase().trim() : ''
      );

      for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        const record = this.mapRowToRecord(headers, row);
        //console.log("maprowrecord", record)
        if (record) {
          allRecords.push(record);
        }
      }
    }

    // Step 2: Clear old data for the batch
    await this.prisma.strips.deleteMany({});

    // Step 3: Process and insert records
    let processedRecords = 0;
    let errorRecords = 0;

    for (const record of allRecords) {
      try {
        const processedRecord = this.processRecord(record, batchId);
          await this.prisma.strips.create({ data: processedRecord });
          processedRecords++;
        
      } catch (error) {
        console.error('❌ Error processing STRIPS record:', record, error.message);
        errorRecords++;
      }
    }

    return {
      totalRecords: allRecords.length,
      processedRecords,
      errorRecords
    };

  } catch (error) {
    console.error('Error processing IM Deal file:', error);
    throw error;
  }
}

  private async parseFile(file: Express.Multer.File): Promise<any[]> {
    const workbook = XLSX.read(file.buffer, { 
      type: 'buffer',
      cellDates: true,
      dateNF: 'dd-mmm-yyyy'
    });
    // Find the "Details" sheet
    const sheetName = Object.keys(workbook.Sheets).find(
      name => name.toLowerCase() === 'strips'
    );
    if (!sheetName) {
      throw new Error('Details sheet not found in STRIPS file');
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      dateNF: 'dd-mmm-yyyy'
    });
    // Find header row
    const headerRowIndex = this.findHeaderRow(jsonData);
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in IM Deal file');
    }
    
    
    // Extract headers
    const headers = (jsonData[headerRowIndex] as string[]).map(h => 
      h ? h.toString().toLowerCase().trim() : ''
    );
    // Process data row
    const records = [];
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i] as any[];
      if (!row || row.length === 0) continue;
      const record = this.mapRowToRecord(headers, row);
      if (record) {
        records.push(record);
      }
    }

    return records;
  }
  
  private findHeaderRow(data: any[]): number {
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const row = data[i];
    if (!row || !Array.isArray(row)) continue;

    const lowerRow = row.map(cell =>
      cell ? cell.toString().toLowerCase().trim() : ''
    );

    const hasISIN = lowerRow.some(h => h.includes('isin'));
    const hasPrice = lowerRow.some(h => h.includes('price'));
    const hasMaturity = lowerRow.some(h => h.includes('maturity'));
    const hasYield = lowerRow.some(h => h.includes('yield'));
    //console.log(hasISIN, hasMaturity, hasPrice, hasYield)
    if (hasISIN && hasPrice && hasMaturity && hasYield) {
      return i;
    }
  }
  return -1;
}
  
  private mapRowToRecord(headers: string[], row: any[]): any {
    //console.log(headers)
    const record: any = {};
    headers.forEach((header, index) => {
      const dbColumn = STRIPS_COLUMN_MAPPING[header];
      if (dbColumn && row[index] !== undefined) {
        const value = this.processValue(dbColumn, row[index]);
        record[dbColumn] = value;
      }
    });
    // Ensure required fields are present
    //console.log(record)
    if (!record.isin || !record.couponStrips || !record.priceRs) {
      return null;
    }
    //console.log(record)
    return record;
  }

private processRecord(record: any, batchId: string): any {
  return {
    isin: record.isin,
    couponStrips: record.couponStrips,
    priceRs: parseFloat(record.priceRs),
    yield: parseFloat(record.yield),
    maturityDate: record.maturityDate instanceof Date 
      ? record.maturityDate 
      : this.parseDate(record.maturityDate),
    uploadBatchId: batchId,
  };
}
}

