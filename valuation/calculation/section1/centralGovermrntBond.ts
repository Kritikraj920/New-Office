import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runCentralGovBondsValuation = async (batchId: string) => {
  try {
    // Step 1: Fetch all FIMMDA rows for this batch that belong to Central Govt Bonds
    const fimmdaRows = await prisma.fIMMDA.findMany({
      where: {
        uploadBatchId: batchId,
        category: 'CENTRAL GOVT BONDS',
      },
    });

    if (fimmdaRows.length === 0) {
      console.log('No Central Govt Bonds found in FIMMDA data.');
      return [];
    }

    // Step 2: Fetch all G_SEC entries
    const gsecRows = await prisma.g_Sec.findMany({
      where: {
        uploadBatchId: batchId,
      },
    });

    if (gsecRows.length === 0) {
      console.log('No G-Sec data found.');
      return [];
    }

    // Step 3: Fetch all STRIPS entries
    const stripRows = await prisma.strips.findMany({
      where: {
        uploadBatchId: batchId,
      },
    });

    if (stripRows.length === 0) {
      console.log('No Strips data found.');
      return [];
    }

    // Step 4: Create a combined market price map from G-Sec and Strips
    const marketPriceMap = new Map<string, number>();

    gsecRows.forEach(row => {
      if (row.isin && row.priceRs != null) {
        marketPriceMap.set(row.isin.trim(), parseFloat(row.priceRs.toString()));
      }
    });

    stripRows.forEach(row => {
      if (row.isin && row.priceRs != null) {
        marketPriceMap.set(row.isin.trim(), parseFloat(row.priceRs.toString()));
      }
    });

    // Step 5: Compare FIMMDA and Market prices from G-Sec/Strips
    const mismatches = [];

    for (const row of fimmdaRows) {
      const isin = row.isin?.trim();
      const fimmdaPrice = parseFloat(row.marketPrice?.toString() || '0');
      const actualMarketPrice = marketPriceMap.get(isin || '');

      if (actualMarketPrice === undefined) {
        mismatches.push({
          ISIN: isin,
          status: 'ISIN not found in G_Sec or Strips',
          fimmdaPrice,
          actualMarketPrice: null,
        });
      } else if (Math.abs(fimmdaPrice - actualMarketPrice) > 0.01) {
        mismatches.push({
          ISIN: isin,
          status: 'Market price mismatch',
          fimmdaPrice,
          actualMarketPrice,
          difference: Math.abs(fimmdaPrice - actualMarketPrice),
          category:'Central Govt Bonds',
        });
      }
    }

    console.log(`Central Govt Bonds Mismatches: ${mismatches.length}`);
    return mismatches;
  } catch (error) {
    console.error('Error in CentralGovBondsValuation:', error);
    throw error;
  }
};