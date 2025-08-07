import { PrismaClient } from '@prisma/client';
import { differenceInCalendarDays } from 'date-fns';

const prisma = new PrismaClient();

interface TreasuryCurvePoint {
  tenor: string; // e.g. '1M', '3M'
  rate: number;
  days: number;
}

export async function runTreasuryBillValuation(batchId: string) {
  // 1. Get all T-Bills from FIMMDA
  const tBills = await prisma.fIMMDA.findMany({
    where: {
      uploadBatchId: batchId,
      category: { equals: 'Treasury Bills', mode: 'insensitive' },
    },
  });
  if(tBills.length==0){
    console.log("No FIMMDA data found");
    return [];
  }
  // 2. Get all points from T-BILL CURVE
  const curvePoints = await prisma.treasuryCurve.findMany({
    where: { uploadBatchId: batchId },
  });
  
  if(curvePoints.length==0){
    console.log("No T_Bill data found");
    return [];
  }

  const curve: TreasuryCurvePoint[] = curvePoints
    .map(point => {
      const tenor = point.tenor?.trim().toUpperCase();
      const rate = Number(point.rate);
      const days = convertTenorToDays(tenor|| '');
      if (!isNaN(days) && !isNaN(rate)) {
        return { tenor, rate, days };
      }
      return null;
    })
    .filter(Boolean) as TreasuryCurvePoint[];

  // 3. Interpolate and calculate market value
  const calculatedResults: any[] = [];

  for (const bill of tBills) {
    const valuationDate = bill.valuationDate;
    const maturityDate = bill.maturityDate;
    if (!valuationDate || !maturityDate) continue;

    const daysToMaturity = differenceInCalendarDays(maturityDate, valuationDate);
    const interpolatedRate = interpolateYield(curve, daysToMaturity);
    const ytm = interpolatedRate / 100;
    const marketPrice = parseFloat((bill.faceValuePerUnit/(1+ytm*daysToMaturity/365)).toFixed(2));
    const difference = parseFloat((bill.marketPrice-marketPrice).toFixed(2)); 
    if(difference>0.01){
      calculatedResults.push({
        ISIN: bill.isin,
        status: 'Market price mismatch',
        fimmdaPrice: bill.marketPrice,
        calculatedMarketPrice: marketPrice,
        difference,
        category:'Treasury Bills',
      });
    }
  }
  return calculatedResults;
}

// --- Helper: Convert '1M', '3M', etc. to days
function convertTenorToDays(tenor: string): number {
  const cleaned = tenor.trim().toLowerCase();

  const match = cleaned.match(/^(\d+)\s*(day|days|month|months|year|years)$/i);
  if (!match) return NaN;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'day':
    case 'days':
      return value;
    case 'month':
    case 'months':
      return value * 30;
    case 'year':
    case 'years':
      return value * 365;
    default:
      return NaN;
  }
}

// --- Helper: Linear Interpolation
function interpolateYield(curve: TreasuryCurvePoint[], targetDays: number): number {
  curve.sort((a, b) => a.days - b.days);

  if (targetDays <= curve[0].days) return curve[0].rate;
  if (targetDays >= curve[curve.length - 1].days) return curve[curve.length - 1].rate;

  for (let i = 0; i < curve.length - 1; i++) {
    const curr = curve[i];
    const next = curve[i + 1];

    if (targetDays >= curr.days && targetDays <= next.days) {
      const slope = (next.rate - curr.rate) / (next.days - curr.days);
      return curr.rate + slope * (targetDays - curr.days);
    }
  }

  return curve[curve.length - 1].rate;
}