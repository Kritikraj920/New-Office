import { PrismaClient } from '@prisma/client';
import { 
  ValuationProcessResult, 
  UploadedFiles,
  ValuationCalculatedValues 
} from './valuationTypes';
//Processor Fle
import { GSECProcessor } from './processors/GSECProcessor';
import { STRIPSProcessor } from './processors/STRIPSProcessor';
import { FIMMDAProcessor } from './processors/FIMMDAProcessor';
import { SDLProcessor } from './processors/SDLProcessor';
import { NSEProcessor } from './processors/NSEBHAVProcessor';
import { TressureCurveProcessor } from './processors/TressureCurveProcessor';
import { CODProcessor } from './processors/CODProcessor';
import { SLVProcessor } from './processors/SLVFileProcessor';
import { CORPORATEProcessor } from './processors/CorparateFileprocessor';
// Calculation fiels
import { runStateGovBondsValuation } from './calculation/section2/stateGovermentBond';
import { runCentralGovBondsValuation } from './calculation/section1/centralGovermrntBond';
import { runEquitySharesValuation } from './calculation/section3/eqityShareBond';
import { runTreasuryBillValuation } from './calculation/section4/treserybillCalculation';
import { runCODCurveValuation } from './calculation/section5/CODCalculation';
import { runCorparateBondsValuation } from './calculation/section6/CorparateBondCalculation';
import { object } from 'joi';
const prisma = new PrismaClient();

export class ValuationService{

  private G_SecProcessor: GSECProcessor;
  private StripsProcessor: STRIPSProcessor;
  private SDLProcessor: SDLProcessor;
  private FIMMDAProcessor: FIMMDAProcessor;
  private NSE_Processor: NSEProcessor;
  private Tressure_Curve_Processor: TressureCurveProcessor;
  private COD_Processor: CODProcessor;
  private SLV_Processor: SLVProcessor;
  private CorporateProcessor:CORPORATEProcessor;
  constructor(){
    this.G_SecProcessor = new GSECProcessor(prisma);
    this.StripsProcessor = new STRIPSProcessor(prisma);
    this.SDLProcessor = new SDLProcessor(prisma);
    this.FIMMDAProcessor = new FIMMDAProcessor(prisma);
    this.NSE_Processor = new NSEProcessor(prisma);
    this.Tressure_Curve_Processor = new TressureCurveProcessor(prisma);
    this.COD_Processor = new CODProcessor(prisma);
    this.SLV_Processor = new SLVProcessor(prisma);
    this.CorporateProcessor = new CORPORATEProcessor(prisma);
  }
    async ProcessFiles(files: UploadedFiles, userId?: string): Promise<ValuationProcessResult> {
      const startTime = Date.now();
      
      // Create processing batch
      const batch = await prisma.valuationProcessingBatch.create({
        data: {
          uploadedBy: userId?.toString() || null,
          status: 'uploading'
        }
      });
  
      try {
        // Update batch status
        await prisma.valuationProcessingBatch.update({
          where: { id: batch.id },
          data: { 
            status: 'processing',
            processingStartedAt: new Date()
          }
        });
  
        // Process each file type
        const processingResults = await this.processAllFiles(files, batch.id);
        console.log("Processing Result",processingResults);
        // Run all calculations
        const calculatedData = await this.runAllCalculations(files,batch.id);
        
        console.log(calculatedData);


        // Update batch status
        await prisma.valuationProcessingBatch.update({
          where: { id: batch.id },
          data: {
            status: 'completed',
            processingCompletedAt: new Date(),
            totalRecords: processingResults.totalRecords,
            processedRecords: processingResults.processedRecords,
            errorRecords: processingResults.errorRecords
          }
        });
  
        const processingTime = Date.now() - startTime;
  
        return {
          success: true,
          batchId: batch.id,
          summary: {
            totalRecords: processingResults.totalRecords,
            processedRecords: processingResults.processedRecords,
            errorRecords: processingResults.errorRecords,
            processingTime
          },
          processedData: calculatedData,
        };
  
      } catch (error:any) {
        // Update batch status on error
        await prisma.valuationProcessingBatch.update({
          where: { id: batch.id },
          data: {
            status: 'failed',
            errors: { message: error.message, stack: error.stack }
          }
        });
  
        console.error('Error processing Valutaion files:', error);
        throw error;
      }
    }

     private async runAllCalculations(files: UploadedFiles,batchId: string): Promise<ValuationCalculatedValues> {
        const results: ValuationCalculatedValues = {};
    
        // Section 1 - Daily Transactions Summary
        console.log('Calculating Valuation Market Price Diffrence');
        if(files.G_SEC && files.STRIPS ){
          Object.assign(results, {centralGovBonds: await runCentralGovBondsValuation(batchId)});
        }
        if(files.SDL){
          Object.assign(results, { stateGovBonds:await runStateGovBondsValuation(batchId)});
        }
        if(files.NSE){
          Object.assign(results, {equityShares:await runEquitySharesValuation(batchId)});
        }
        if(files.Treasury_Curve){
          Object.assign(results, {treasuryBills:await runTreasuryBillValuation(batchId)});
        }
        if(files.CD_CURVE){
          Object.assign(results, {codCurve:await runCODCurveValuation(batchId)});
        }
        if(files.SLV && files.CORPORATE_BOND){
          Object.assign(results,{corporatebond:await runCorparateBondsValuation(batchId)})
        }
        
        return results;
      }
    
     /**
       * Process all uploaded files
       */
      private async processAllFiles(files: UploadedFiles, batchId: string) {
        let totalRecords = 0;
        let processedRecords = 0;
        let errorRecords = 0;
    
        console.log('Processing Valuation files in processallfiles:', Object.keys(files).filter((k) => files[k]));
    
        // Process IM Deal file 
        if (files.G_SEC) {
          console.log('Processing G_SEC Deal file...');
          const result = await this.G_SecProcessor.processFile(files.G_SEC, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { gsecFileUploaded: true }
          });
        }
        if (files.STRIPS) {
          console.log('Processing STRIPS Deal file...');
          const result = await this.StripsProcessor.processFile(files.STRIPS, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { sdlFileUploaded: true }
          });
        }
        if (files.SDL) {
          console.log('Processing SDL Deal file...');
          const result = await this.SDLProcessor.processFile(files.SDL, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { sdlFileUploaded: true }
          });
        }
        if (files.NSE) {
          console.log('Processing NSE Deal file...');
          const result = await this.NSE_Processor.processFile(files.NSE, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { nseFileUploaded: true }
          });
        }
        if (files.FIMMDA_VAL) {
          console.log('Processing FIMDDA Deal file...');
          const result = await this.FIMMDAProcessor.processFile(files.FIMMDA_VAL, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { fimmdaFileUploaded: true }
          });
        }
        if (files.Treasury_Curve) {
          console.log('Processing Treasurt Curve File Deal file...');
          const result = await this.Tressure_Curve_Processor.processFile(files.Treasury_Curve, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { tressurecurveFileUploaded: true }
          });
        }
        if (files.CD_CURVE) {
          console.log('Processing CD Curve File Deal file...');
          const result = await this.COD_Processor.processFile(files.CD_CURVE, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { codFileUploaded: true }
          });
        }
        if (files.SLV) {
          console.log('Processing SLV Curve File Deal file...');
          const result = await this.SLV_Processor.processFile(files.SLV, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { slvFileUploaded: true }
          });
        }
        if (files.CORPORATE_BOND) {
          console.log('Processing Corporate Bond File Deal file...');
          const result = await this.CorporateProcessor.processFile(files.CORPORATE_BOND, batchId);
          totalRecords += result.totalRecords;
          processedRecords += result.processedRecords;
          errorRecords += result.errorRecords;
          
          await prisma.valuationProcessingBatch.update({
            where: { id: batchId },
            data: { corporatebondFileUploaded: true }
          });
        }

        return { totalRecords, processedRecords, errorRecords };
}
  //  * Get results by batch ID
  //  */
  // async getResultsByBatchId(batchId: string): Promise<ValuationProcessResult> {
  //   const batch = await prisma.valuationProcessingBatch.findUnique({
  //     where: { id: batchId }
  //   });

  //   if (!batch) {
  //     throw new Error('Batch not found');
  //   }

  //   // const results = await prisma.pdr1CalculatedResult.findMany({
  //   //   where: { batchId }
  //   // });

  //   // Transform results back to the expected format
  //   // const processedData: Pdr1CalculatedValues = {};
  //   // const dateSet = new Set<string>();

  //   // results.forEach(result => {
  //   //   if (!processedData[result.sectionId]) {
  //   //     processedData[result.sectionId] = {};
  //   //   }
  //   //   const dateStr = this.formatDate(result.valueDate);
  //   //   processedData[result.sectionId][dateStr] = result.calculatedValue;
  //   //   dateSet.add(dateStr);
  //   // });

  //   return {
  //     success: true,
  //     batchId,
  //     summary: {
  //       totalRecords: batch.totalRecords,
  //       processedRecords: batch.processedRecords,
  //       errorRecords: batch.errorRecords,
  //       processingTime: 0
  //     },
  //   };
  // }
  
}
