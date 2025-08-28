import { PrismaClient } from '@prisma/client';
import { ProcessingResult, ShortSaleRecord } from '../shortsaleTypes';
import { BaseFileProcessor } from './BaseFileProcessor';
import PDFParser from 'pdf2json';

export class ACTIVITYLOGProcessor extends BaseFileProcessor {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  async processFile(file: Express.Multer.File, batchId: string): Promise<ProcessingResult> {

    try {
      let processedRecords = 0;
      let errorRecords = 0;

      const pdfRecords = await this.parsePDFAndExtractRecords(file.buffer);
      await this.prisma.ndsactivityPdf.deleteMany({});
      for (let i = 0; i < pdfRecords.length; i++) {
        const record = pdfRecords[i];
        try {
          const processedRecord = this.processRecord(record, batchId);
          await this.prisma.ndsactivityPdf.create({ data: processedRecord });
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
      console.error('❌ Error processing Short Sale file:', error);
      throw error;
    }
  }

  private parsePDFAndExtractRecords(buffer: Buffer): Promise<Partial<ShortSaleRecord>[]> {
    return new Promise((resolve, reject) => {
      const pdfParser = new PDFParser();

      pdfParser.on("pdfParser_dataError", (errData: { parserError: any }) => reject(errData.parserError));

      pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: { Texts: any[] }[] }) => {
        const records = this.extractShortSaleRecords(pdfData);
        resolve(records);
      });

      pdfParser.parseBuffer(buffer);
    });
  }

  private extractShortSaleRecords(pdfData: { Pages: { Texts: any[] }[] }): Partial<ShortSaleRecord>[] {
    const records: Partial<ShortSaleRecord>[] = [];
    let reportDate: string | undefined;

    pdfData.Pages.forEach((page) => {
      const textChunks: string[] = [];

      page.Texts.forEach((textObj) => {
        textObj.R.forEach((run: { T: string }) => {
          const decodedText = decodeURIComponent(run.T);
          textChunks.push(decodedText);
        });
      });
      let fullText = textChunks.join(" ");
      const reportText = fullText; // your full report text here
      // Split the report into lines
      const lines = reportText.split(/(?=Proprietar y)/);
      // Store extracted values
      const uncoveredAmounts: string[] = [];

      for (const line of lines) {
        if (line.includes("Proprietar y")) {
          // Match all numeric values with format like 123.456 0 or 1,234.567 0
          const matches = line.match(/\d{1,3}(?:,\d{3})*\.\d{3}\s0/g);
          // If matches found, the second one is usually the Cumulative Uncovered Amount
          if (matches && matches.length >= 2) {
            uncoveredAmounts.push(matches[1]); // index 1 is the second value
          }
        }
      }
      // Collapse all spaces to handle irregular spacing
      const collapsedText = fullText.replace(/\s+/g, "");

      // Extract Report Date (e.g., 25Jul2025)
      const reportDateMatch = collapsedText.match(/ReportDate:\d{2}(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{4}/);
      if (reportDateMatch) {
        const rawDate = reportDateMatch[0].match(/\d{2}Jul\d{4}/)?.[0];
        if (rawDate) {
          reportDate = `${rawDate.slice(0, 2)} Jul ${rawDate.slice(5)}`;
        }
      }

      // Normalize the text: remove spaces between letters and digits
      const normalizedText = fullText.replace(/([A-Z0-9])\s+(?=[A-Z0-9])/g, "$1");
      const isinRegex = /IN\d{10}/g;
      const rawIsins = normalizedText.match(isinRegex) || [];

      // Remove duplicates
      const isins = Array.from(new Set(rawIsins));
      isins.forEach((isin, index) => {

        const pos = fullText.indexOf(isin);
        const block = fullText.slice(Math.max(0, pos - 200), pos + 200);
        const securityMatch = block.match(/\d{2}\.\d{2} GS \d{4}/);
        const maturityMatch = block.match(/\d{2}\s?[A-Za-z]{3}\s?\d{3}\s?\d?/);

        const auctionCoverRegex = /(\d{1,4}\.\d{3})\s*0\s*(\d{1,4}\.\d{3})\s*0\s*(\d{1,4}\.\d{3})\s*0/g;
        const matches = [...block.matchAll(auctionCoverRegex)];

        let auctionCover: string | null = null;

        if (matches.length > 0) {
          const isinIndex = block.indexOf(isin);

          for (const match of matches) {
            const matchIndex = block.indexOf(match[0]);

            // ✅ Only consider matches that appear after the ISIN
            if (matchIndex > isinIndex) {
              const values = match[0].match(/(\d{1,4}\.\d{3})/g);
              if (values && values.length === 3) {
                auctionCover = values[2]; // Third value is Auction Cover
                break;
              }
            }
          }
        }

        let cleanedDate: string | null = null;

        if (maturityMatch) {
          const raw = maturityMatch[0];
          // Fix the year if it's split like "203 4"
          cleanedDate = raw.replace(/(\d{2})\s?([A-Za-z]{3})\s?(\d{3})\s?(\d)/, (_, d, m, y1, y2) => {
            return `${d} ${m} ${y1}${y2}`;
          });
        }

        // Extract all numeric values in the format xxx.xxx 0
        const numericMatches = block.match(/\d{1,3}(?:,\d{3})*\.\d{3}\s0/g);
        const ndsShortMatch = block.match(/(\d{1,3}\.\d{3})\s*0\s*(\d{1,3}\.\d{3})\s*0/);
        const ndsCoverMatch = block.match(/(\d{1,3}\.\d{3})\s*0\s*(\d{1,3}\.\d{3})\s*0/);

        records.push({
          ReportinDate: reportDate,
          ISIN: isin,
          Security: securityMatch ? securityMatch[0] : null,
          MaturityDate: cleanedDate || null,

          CumulativeUncoveredAmount: uncoveredAmounts[index] || null,

          NDSOMShortSale: ndsShortMatch ? ndsShortMatch[2] : null,
          NDSOMCover: ndsCoverMatch ? ndsCoverMatch[1] : null,
          AuctionCover: auctionCover || null
        });
      });
    });

    return records;
  }

  private processRecord(record: Partial<ShortSaleRecord>, batchId: string): any {
    return {
      reportindate: record.ReportinDate ?? null,
      isin: record.ISIN ?? null,
      security: record.Security ?? null,
      maturitydate: record.MaturityDate ?? null,
      cumulativeuncoveredamount: record.CumulativeUncoveredAmount ?? null,
      ndsomshortsale: record.NDSOMShortSale ?? null,
      ndsomcover: record.NDSOMCover ?? null,
      auctioncover: record.AuctionCover ?? null,
      uploadBatchId: batchId,
    };
  }
}


