import { PrismaClient } from "@prisma/client";
import PDFParser from "pdf2json";
import { ProcessingResult } from "../valuationTypes";

export class PDFActivityLogProcessor {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {
    try {
      const pdfData = await this.parsePDF(file.buffer);

      // If you want to clear old records for this batch
      await this.prisma.activityLog.deleteMany({
        where: { uploadBatchId: batchId }
      });

      let processedRecords = 0;
      let errorRecords = 0;

      for (const rec of pdfData) {
        try {
          await this.prisma.activityLog.create({
            data: {
              transactionNo: rec.transactionNo,
              matchedTime: rec.matchedTime,
              uploadBatchId: batchId
            }
          });
          processedRecords++;
        } catch (err) {
          console.error("DB Insert Error:", err);
          errorRecords++;
        }
      }

      return {
        totalRecords: pdfData.length,
        processedRecords,
        errorRecords
      };
    } catch (err) {
      console.error("Error processing PDF file:", err);
      throw err;
    }
  }

  private parsePDF(buffer: Buffer): Promise<{ transactionNo: string; matchedTime: string }[]> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        const rawText = pdfData.formImage.Pages
          .map(page =>
            page.Texts.map(t =>
              decodeURIComponent(t.R[0].T) // decode text
            ).join(" ")
          )
          .join("\n");

        const results: { transactionNo: string; matchedTime: string }[] = [];

        // Regex to match Transaction No followed by "Matched" and a time
        const transactionRegex = /(\d{15})[\s\S]*?Matched\s+Matched\s+(\d{15})\s+(\d{2}:\d{2}:\d{2})/g;

        let match;
        while ((match = transactionRegex.exec(rawText)) !== null) {
          results.push({
            transactionNo: match[2], // matched transaction number
            matchedTime: match[3]   // matched time
          });
        }

        resolve(results);
      });

      pdfParser.parseBuffer(buffer);
    });
  }
}
TypeError: Cannot read properties of undefined (reading 'Pages')
    at gi.<anonymous> (C:\Users\Kritik.Raj\OneDrive - Grant Thornton Advisory Private Limited\Desktop\AG_GT\ag-gt-app\backend\src\services\breakCheck\processors\PDFActivityLogProcessor.ts:57:43)
    at gi.emit (node:events:518:28)
    at gi.onPDFJSParseDataReady (C:\Users\Kritik.Raj\OneDrive - Grant Thornton Advisory Private Limited\Desktop\AG_GT\ag-gt-app\backend\node_modules\pdf2json\pdfparser.js:118:9)
    at hi.<anonymous> (C:\Users\Kritik.Raj\OneDrive - Grant Thornton Advisory Private Limited\Desktop\AG_GT\ag-gt-app\backend\node_modules\pdf2json\pdfparser.js:140:9)
    at hi.emit (node:events:518:28)
    at C:\Users\Kritik.Raj\OneDrive - Grant Thornton Advisory Private Limited\Desktop\AG_GT\ag-gt-app\backend\node_modules\pdf2json\lib\pdf.js:187:31
    at processTicksAndRejections (node:internal/process/task_queues:85:11)
[ERROR] 23:27:18 TypeError: Cannot read properties of undefined (reading 'Pages')

private parsePDF(buffer: Buffer): Promise<{ transactionNo: string; matchedTime: string }[]> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", (errData) => reject(errData.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      if (!pdfData?.formImage?.Pages) {
        return reject(new Error("No text layer found in PDF (might be scanned or image-based PDF)."));
      }

      let rawText = "";
      pdfData.formImage.Pages.forEach((page) => {
        page.Texts.forEach((textObj) => {
          rawText += decodeURIComponent(textObj.R[0].T) + " ";
        });
        rawText += "\n";
      });

      const results: { transactionNo: string; matchedTime: string }[] = [];

      // This regex matches the transaction no followed later by matched time
      const transactionRegex = /(\d{15})[\s\S]*?Matched\s+Matched\s+(\d{15})\s+(\d{2}:\d{2}:\d{2})/g;

      let match;
      while ((match = transactionRegex.exec(rawText)) !== null) {
        results.push({
          transactionNo: match[2],
          matchedTime: match[3],
        });
      }

      resolve(results);
    });

    pdfParser.parseBuffer(buffer);
  });
}
