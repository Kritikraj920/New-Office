import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runEquitySharesValuation = async (batchId: string) => {
  try {
    // Step 1: Fetch all FIMMDA rows for this batch that belong to State Govt Bonds
    const fimmdaRows = await prisma.FIMMDA.findMany({
      where: {
        uploadBatchId:batchId,
        category: 'EQUITY SHARES',
      },
    });

    if (fimmdaRows.length === 0) {
      console.log('No Equity Share found in FIMMDA data.');
      return [];
    }

    // Step 2: Fetch all SDL entries (from both SDL and UDAY sheets)
    const NSERows = await prisma.NSE.findMany({
      where: {
        uploadBatchId:batchId,
      },
    });
    // console.log(sdlRows);
    if (NSERows.length === 0) {
      console.log('No NSE data found.');
      return [];
    }

    // Step 3: Map NSE data by ISIN for fast lookup
    const NSEMap = new Map<string, number>(); // ISIN -> MarketPrice
    NSERows.forEach(row => {
      if (row.isin && row.SttlmPric) {
        NSEMap.set(row.isin.trim(), parseFloat(row.SttlmPric.toString()));
      }
    });
    

    // Step 4: Compare FIMMDA and SDL market prices
    const mismatches = [];

    for (const row of fimmdaRows) {
      const isin = row.isin?.trim();
      const fimmdaPrice = parseFloat(row.marketPrice?.toString() || '0');
      const NSEPrice = NSEMap.get(isin || '');
    //   console.log(fimmdaPrice,sdlPrice);
      if (NSEPrice === undefined) {
        mismatches.push({
          ISIN: isin,
          status: 'ISIN not found in NSE',
          fimmdaPrice,
          NSEPrice: null,
        });
      } else if (Math.abs(NSEPrice-fimmdaPrice) > 0.01) {
        const diffrence=Math.abs(NSEPrice-fimmdaPrice)
        mismatches.push({
          ISIN: isin,
          status: 'Market price mismatch',
          fimmdaPrice,
          NSEPrice,
          diffrence,
          category:'Equity shares',
        });
      }
    }
    console.log(`EQUITY SHARES Bonds Mismatches: ${mismatches.length}`);
    return mismatches;
  } catch (error) {
    console.error('Error in EQUITYSHARESBondsValuation:', error);
    throw error;
  }
};