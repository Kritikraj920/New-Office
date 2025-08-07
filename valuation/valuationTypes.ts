export interface UploadedFiles {
    FIMMDA_VAL?: Express.Multer.File;
    G_SEC?: Express.Multer.File;
    STRIPS?: Express.Multer.File;
    SDL?: Express.Multer.File;
    NSE?: Express.Multer.File;
    Treasury_Curve?: Express.Multer.File;
    CD_CURVE?: Express.Multer.File;
    SLV?: Express.Multer.File;
    CORPORATE_BOND?: Express.Multer.File;
}
export interface ValuationProcessResult {
    success: boolean;
    batchId?: string;
    summary: {
        totalRecords: number;
        processedRecords: number;
        errorRecords: number;
        processingTime: number;
    };
    processedData: ValuationCalculatedValues;
      error?: string;
}
export interface ValuationCalculatedValues {
    [sectionId: string]: {
        [date: string]: number;
    };
}
export interface ProcessingResult {
    totalRecords: number;
    processedRecords: number;
    errorRecords: number;
}

export const FIMMDA_COLUMN_MAPPING: Record<string, string> = {
  'valuation date': 'valuationDate',
  'instrument id': 'instrumentId',
  'portfolio': 'portfolio',
  'isin': 'isin',
  'security name': 'securityName',
  'category': 'category',
  'sub category': 'subCategory',
  'instrument type': 'instrumentType',
  'slr/ nslr': 'slrNslr',
  'issuer': 'issuer',
  'face value per unit': 'faceValuePerUnit',
  'quantity': 'quantity',
  'face value': 'faceValue',
  'wap': 'wap',
  'current yield': 'currentYield',
  'book value': 'bookValue',
  'maturity date': 'maturityDate',
  'coupon': 'coupon',
  'market value': 'marketValue',
  'market price': 'marketPrice',
  'mp as per valuation': 'marketPriceValuation',
  'difference': 'difference',
  'market yield': 'marketYield',
  'appreciation': 'appreciation',
  'depreciation': 'depreciation',
};

export const G_SEC_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',
};
export const STRIPS_COLUMN_MAPPING: Record<string, string> = {
    'isin':'isin',
    'coupon strips':'couponStrips',
    'maturity (dd-mmm-yyyy)':'maturityDate',
    'price(rs)':'priceRs',
    'yield% (semi-annual)':'yield',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
export const SDL_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
export const FIMDDA_COLUMN_MAPPING: Record<string, string> = {
    'isin':'ISIN',
    'description':'Description',
    'coupon':'Coupon',
    'maturity(dd-mmm-yyyy)':'Maturity',
    'price(rs)':'Price',
    'ytm% p.a. (semi-annual)':'YTM',

    // Note: Removed operationType, dealCurrency, interestPractice, etc. 
    // as they don't exist in the Prisma schema
};
export const NSE_COLUMN_MAPPING: Record<string, string> = {
  'traddt': 'tradDt',
  'bizdt': 'bizDt',
  'sgmt': 'segmt',
  'src': 'src',
  'fininstrmtp': 'finInstrmTp',
  'fininstrmid': 'finInstrmId',
  'isin': 'isin',
  'tckrsymb': 'tckrSymb',
  'sctysrs': 'sctySrs',
  'xprydt': 'xpryDt',
  'fininstrmactlxprydt': 'fininstrmActlXpryDt',
  'strkpric': 'strkPric',
  'optntp': 'optnTp',
  'fininstrmnm': 'finInstrmNm',
  'clspric': 'clspric', // pick only fields you need
  'sttlmpric':'SttlmPric',

};
export const SLV_COLUMN_MAPPING: Record<string, string> ={
  'isin':'isin',
  'name of issuer':'issuer',
  'coupon rate':'coupon',
  'maturity date':'maturutydate',
  'rating':'rating',
  'segment of issuer':'segmentofissuer',
  'model yield for 27-jun-2025':'modelyield',
  'model price':'modelprice',
  '15 days yield':'yield15days',
  '15 days price':'price15days',
  'final yield':'finalyield',
  'final price':'finalprice',
}
export const CORPORATE_COLOUM_MAPPING: Record<string,string> = {
'residual tenor':'residualtenor',
'isin':'isin',
'description':'description',
'coupon':'coupon',
'maturity':'maturity',
'next call/put date *new c':'nextcallputdate',
'nsdl / bse ratings* (to be confirmed by uers)':'nsdlLbseratings',
'segment':'segment',
'date dealt':'datedealt',
'primary/ secondary market':'prisecmarket',
'weighted avg. yield':'weigavgyield',
'g-sec interpolated yield (annualized)':'gsecinterpolatedyield',
'spread over g-sec':'spreadovergsec',
'cum. value (cr)':'cumvalue',
'no of trades':'trades',
'w. a. price':'waprice',
'remark *new c':'remark',
}
export const T_BILL_CURVE_COLUMN_MAPPING: Record<string, string> = {
  'date': 'date',
  'time': 'time',
  'tenor': 'tenor',
  'rate(%)': 'rate',
};
export const CD_CURVE_COLUMN_MAPPING: Record<string, string> = {
  'date': 'date',
  'time': 'time',
  'tenor': 'tenor',
  'rate(%)': 'rate',
};
export const NUMERIC_COLUMNS = [
    'quantity', 'mktNominalVal', 'price', 'rateYield', 
    'bookValue', 'accruedInterestDays', 'accruedInterestAmount',
    'settlementAmount', 'brokerageAmount', 'taxOtherCharges',
    'holdingCost', 'profitLoss', 'faceValue', 'leg1Price',
    'leg2Price', 'rate', 'principal', 'baseEqvlnt',
    'marketValue', 'marketPrice', 'wap', 'mDuration',
    'pvbp', 'accruedInterest', 'ownStock', 'repo',
    'rbiRefinance', 'collateral', 'lien', 'sgf',
    'derivative', 'treps', 'deflt', 'totalPledged',
    'netPosition', 'settlementAmountLeg1', 'settlementAmountLeg2',
    'outstandingAmount', 'tenor', 'interestAmount',
    'principalPlusInterest', 'spread'
  ];
  
  // For date columns
export const DATE_COLUMNS = [
    'valueDate', 'dealDate', 'maturityDate', 'authorizerDate',
    'date', 'lastInterestDate', 'nextInterestDate'
  ];