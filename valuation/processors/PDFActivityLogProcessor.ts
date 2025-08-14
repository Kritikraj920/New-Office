import { PrismaClient } from '@prisma/client';
import { ProcessingResult } from '../breakCheckTypes';
import { BaseFileProcessor } from './BaseFileProcessor';
import PDFParser from 'pdf2json';

export class ACTIVITYLOGProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    console.log("📄 File received:", file.originalname);

    try {
      let processedRecords = 0;
      let errorRecords = 0;

      const pdfRecords = await this.parsePDFAndExtractRecords(file.buffer);
      console.log("✅ Extracted Records:", pdfRecords);

      await this.prisma.activityLogPdf.deleteMany({});

      for (let i = 0; i < pdfRecords.length; i++) {
        const record = pdfRecords[i];
        try {
          const processedRecord = this.processRecord(record, batchId);
          await this.prisma.activityLogPdf.create({ data: processedRecord });
          processedRecords++;
        } catch (error) {
          console.error('❌ Error processing ActivityLogPdf record:', error);
          errorRecords++;
        }
      }
      return {
        totalRecords: pdfRecords.length,
        processedRecords,
        errorRecords,
        errors: {}
      };

    } catch (error) {
      console.error('❌ Error processing IM Deal file:', error);
      throw error;
    }
  }

  private parsePDFAndExtractRecords(buffer: Buffer): Promise<{ transactionNo: string; matchedTime: string }[]> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData: { parserError: any }) => reject(errData.parserError));

      pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: { Texts: any[] }[] }) => {
        const records = this.extractMatchedTransactions(pdfData);
        resolve(records);
      });

      pdfParser.parseBuffer(buffer);
    });
  }

  private extractMatchedTransactions(pdfData: { Pages: { Texts: any[] }[] }): { transactionNo: string; matchedTime: string }[] {
    const matchedRecords: { transactionNo: string; matchedTime: string }[] = [];

    pdfData.Pages.forEach((page) => {
      const textChunks: string[] = [];

      page.Texts.forEach((textObj) => {
        textObj.R.forEach((run: { T: string }) => {
          const decodedText = decodeURIComponent(run.T);
          textChunks.push(decodedText);
        });
      });

      const fullText = textChunks.join(" ");

      const matchedSections = fullText.match(/2025\d{9,}.*?Matched.*?\d{2}:\d{2}:\d{2}/gs) || [];

      matchedSections.forEach((section) => {
        const txnMatch = section.match(/2025\d{9,}/);
        const timeMatch = section.match(/\d{2}:\d{2}:\d{2}/);

        if (txnMatch && timeMatch) {
          matchedRecords.push({
            transactionNo: txnMatch[0],
            matchedTime: timeMatch[0],
          });
        }
      });
    });

    return matchedRecords;
  }

  private processRecord(record: { transactionNo: string; matchedTime: string }, batchId: string): any {
    return {
      transactionNo: record.transactionNo,
      matchedTime: record.matchedTime,
      uploadBatchId: batchId,
    };
  }
}
