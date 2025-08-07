import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runStateGovBondsValuation = async (batchId: string) => {
  try {
    // Step 1: Fetch all FIMMDA rows for this batch that belong to State Govt Bonds
    const fimmdaRows = await prisma.FIMMDA.findMany({
      where: {
        uploadBatchId:batchId,
        category: 'STATE GOVT BONDS',
      },
    });

    if (fimmdaRows.length === 0) {
      console.log('No State Govt Bonds found in FIMMDA data.');
      return [];
    }

    // Step 2: Fetch all SDL entries (from both SDL and UDAY sheets)
    const sdlRows = await prisma.SDL.findMany({
      where: {
        uploadBatchId:batchId,
      },
    });
    // console.log(sdlRows);
    if (sdlRows.length === 0) {
      console.log('No SDL/UDAY data found.');
      return [];
    }

    // Step 3: Map SDL data by ISIN for fast lookup
    const sdlMap = new Map<string, number>(); // ISIN -> MarketPrice
    sdlRows.forEach(row => {
      if (row.isin && row.priceRs) {
        sdlMap.set(row.isin.trim(), parseFloat(row.priceRs.toString()));
      }
    });
    

    // Step 4: Compare FIMMDA and SDL market prices
    const mismatches = [];

    for (const row of fimmdaRows) {
      const isin = row.isin?.trim();
      const fimmdaPrice = parseFloat(row.marketPrice?.toString() || '0');
      const sdlPrice = sdlMap.get(isin || '');
    //   console.log(fimmdaPrice,sdlPrice);
      if (sdlPrice === undefined) {
        mismatches.push({
          ISIN: isin,
          status: 'ISIN not found in SDL',
          fimmdaPrice,
          sdlPrice: null,
        });
      } else if (Math.abs(sdlPrice-fimmdaPrice) > 0.01) {
        const diffrence=Math.abs(sdlPrice-fimmdaPrice)
        mismatches.push({
          ISIN: isin,
          status: 'Market price mismatch',
          fimmdaPrice,
          sdlPrice,
          diffrence,
          category:'State Govt Bonds',
        });
      }
    }
    console.log(`State Govt Bonds Mismatches: ${mismatches.length}`);
    return mismatches;
  } catch (error) {
    console.error('Error in StateGovBondsValuation:', error);
    throw error;
  }
};