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
