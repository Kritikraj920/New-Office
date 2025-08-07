import { PrismaClient } from '@prisma/client';
import { calculateCorparateMarketPrice } from './calculatemarketprice';
const prisma = new PrismaClient();

export const runCorparateBondsValuation = async (batchId: string) => {
  try {
    // Step 1: Fetch all FIMMDA rows for this batch that belong to Central Govt Bonds
    const fimmdaRows = await prisma.fIMMDA.findMany({
      where: {
        uploadBatchId: batchId,
        category: 'CORPORATE BONDS',
      },
    });

    if (fimmdaRows.length === 0) {
      console.log('No Central Govt Bonds found in FIMMDA data.');
      return [];
    }

    // Step 2: Fetch all G_SEC entries
    const slvRows = await prisma.SLV.findMany({
      where: {
        uploadBatchId: batchId,
      },
    });

    if (slvRows.length === 0) {
      console.log('No SLV data found.');
      return [];
    }

    // Step 3: Fetch all STRIPS entries
    const coparateRows = await prisma.Corporate.findMany({
      where: {
        uploadBatchId: batchId,
      },
    });

    if (coparateRows.length === 0) {
      console.log('No Strips data found.');
      return [];
    }

    // Step 4: Create a combined market price map from G-Sec and Strips
    const marketPriceMap = new Map<string, number>();

    slvRows.forEach(row => {
      if (row.isin && row.finalprice != null) {
        marketPriceMap.set(row.isin.trim(), parseFloat(row.finalprice.toString()));
      }
    });

    coparateRows.forEach(row => {
      if (row.isin && row.weightedAvgPrice != null) {
        marketPriceMap.set(row.isin.trim(), parseFloat(row.weightedAvgPrice.toString()));
      }
    });

    // Step 5: Compare FIMMDA and Market prices from SLV/Corporate
    const mismatches = [];

    for (const row of fimmdaRows) {
      const isin = row.isin?.trim();
      let fimmdaPrice = parseFloat(row.marketPriceValuation?.toString() || '0');
      if(fimmdaPrice==0){
        const newprice = await prisma.Corporate.findFirst({
            where:{ 
                isin:isin, 
                uploadBatchId: batchId,
            },
        });
        if(newprice!=null){
          fimmdaPrice = newprice.weightedAvgPrice;
        }
        else{
         fimmdaPrice = calculateCorparateMarketPrice(isin)
        }
      }
      const actualMarketPrice = marketPriceMap.get(isin || '');
        
      if (actualMarketPrice === undefined) {
        mismatches.push({
          ISIN: isin,
          status: 'ISIN not found in SLV or Corporate',
          fimmdaPrice,
          actualMarketPrice: null,
          category:'Corporate Bonds',
        });
      } else if (Math.abs(fimmdaPrice - actualMarketPrice) > 0.0001) {
        mismatches.push({
          ISIN: isin,
          status: 'Market price mismatch',
          fimmdaPrice,
          actualMarketPrice,
          difference: Math.abs(fimmdaPrice - actualMarketPrice),
          category:'Corporate Bonds',
        });
      }
    }

    console.log(`Corporate Bonds Mismatches: ${mismatches.length}`);
    return mismatches;
  } catch (error) {
    console.error('Error in CorporateBondValuation:', error);
    throw error;
  }
};