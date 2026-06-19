import { EventEmitter } from 'events';
import { 
  createJob, 
  getJobById, 
  updateJobStatus, 
  getQueuedJobs, 
  updateQueuePosition,
  updateJobPaid,
  updateJobRefund,
  getQueueCount,
} from '../models/printJob';
import { getIdlePrinters, updatePrinterStatus, updatePrinterPaperLevel } from '../models/printer';
import { calculatePrice, calculateTotalPages, calculateRefundAmount } from './pricingService';
import { PrintJob, PrintStatus, FailureReason, RefundStatus, CreateJobInput } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface CreateJobOptions extends CreateJobInput {
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
}

class PrintQueueService extends EventEmitter {
  private isProcessing: boolean = false;

  constructor() {
    super();
  }

  async createJob(options: CreateJobOptions): Promise<PrintJob> {
    const id = uuidv4();
    const totalPages = calculateTotalPages(options.pageCount, options.side, options.copies);
    const amount = calculatePrice(options.pageCount, options.color, options.side, options.copies);
    
    const position = getQueueCount() + 1;
    
    const job = createJob({
      id,
      studentId: options.studentId,
      studentName: options.studentName,
      fileName: options.fileName,
      filePath: options.filePath,
      fileSize: options.fileSize,
      pageCount: options.pageCount,
      color: options.color,
      side: options.side,
      copies: options.copies,
      totalPages,
      amount,
      status: 'queued',
      queuePosition: position,
    });

    this.emit('jobQueued', job);
    this.processQueue();

    return job;
  }

  async cancelJob(jobId: string, reason: string = 'user_cancelled'): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job) return null;

    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
      return job;
    }

    if (job.status === 'printing') {
      const refundAmount = calculateRefundAmount(job.amount, job.totalPages, job.printedPages);
      updateJobStatus(jobId, 'cancelled', {
        failureReason: reason as FailureReason,
        failureMessage: '用户取消打印',
      });
      updateJobRefund(jobId, 'pending', refundAmount);
      this.emit('jobCancelled', job, refundAmount);
      this.processRefund(jobId, refundAmount);
    } else if (job.status === 'queued') {
      updateJobStatus(jobId, 'cancelled', {
        failureReason: reason as FailureReason,
        failureMessage: '用户取消打印',
      });
      updateJobRefund(jobId, 'none', 0);
      this.emit('jobCancelled', job, 0);
    }

    this.reorderQueue();

    return getJobById(jobId);
  }

  async handlePaperJam(jobId: string, printedPages: number): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return null;

    const refundAmount = calculateRefundAmount(job.amount, job.totalPages, printedPages);
    
    updateJobStatus(jobId, 'paper_jam', {
      failureReason: 'paper_jam',
      failureMessage: '打印机卡纸',
      printedPages,
    });
    updateJobRefund(jobId, 'pending', refundAmount);
    
    this.emit('paperJam', job, printedPages, refundAmount);
    this.processRefund(jobId, refundAmount);

    return getJobById(jobId);
  }

  async handleOutOfPaper(jobId: string, printedPages: number): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return null;

    const refundAmount = calculateRefundAmount(job.amount, job.totalPages, printedPages);
    
    updateJobStatus(jobId, 'out_of_paper', {
      failureReason: 'out_of_paper',
      failureMessage: '打印机缺纸',
      printedPages,
    });
    updateJobRefund(jobId, 'pending', refundAmount);
    
    this.emit('outOfPaper', job, printedPages, refundAmount);
    this.processRefund(jobId, refundAmount);

    return getJobById(jobId);
  }

  async completeJob(jobId: string): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job) return null;

    const now = new Date().toISOString();
    updateJobStatus(jobId, 'completed', {
      printedPages: job.totalPages,
      completedAt: now,
    });

    updateJobPaid(jobId, true);

    this.emit('jobCompleted', job);
    this.processQueue();

    return getJobById(jobId);
  }

  private async processRefund(jobId: string, refundAmount: number): Promise<void> {
    setTimeout(() => {
      const job = getJobById(jobId);
      if (!job) return;

      if (refundAmount > 0) {
        updateJobRefund(jobId, 'processed', refundAmount);
        this.emit('refundProcessed', job, refundAmount);
      } else {
        updateJobRefund(jobId, 'none', 0);
      }
    }, 1000);
  }

  private reorderQueue(): void {
    const queuedJobs = getQueuedJobs();
    queuedJobs.forEach((job, index) => {
      updateQueuePosition(job.id, index + 1);
    });
  }

  processQueue(): void {
    if (this.isProcessing) return;

    const idlePrinters = getIdlePrinters();
    if (idlePrinters.length === 0) return;

    const queuedJobs = getQueuedJobs();
    if (queuedJobs.length === 0) return;

    this.isProcessing = true;

    const printer = idlePrinters[0];
    const job = queuedJobs[0];

    updatePrinterStatus(printer.id, 'busy', job.id);
    updateJobStatus(job.id, 'printing', {
      startedAt: new Date().toISOString(),
    });
    updateQueuePosition(job.id, null);

    this.emit('jobStarted', job, printer);

    this.simulatePrinting(job.id, printer.id);
  }

  private simulatePrinting(jobId: string, printerId: string): void {
    const job = getJobById(jobId);
    if (!job) return;

    let printedPages = 0;
    const totalPages = job.totalPages;
    const printTimePerPage = 500;

    const printInterval = setInterval(() => {
      const currentJob = getJobById(jobId);
      if (!currentJob || currentJob.status !== 'printing') {
        clearInterval(printInterval);
        this.isProcessing = false;
        updatePrinterStatus(printerId, 'idle');
        return;
      }

      printedPages++;
      updateJobStatus(jobId, 'printing', { printedPages });
      
      this.emit('printProgress', jobId, printedPages, totalPages);

      if (printedPages >= totalPages) {
        clearInterval(printInterval);
        this.completeJob(jobId);
        updatePrinterStatus(printerId, 'idle');
        this.isProcessing = false;
        this.reorderQueue();
        this.processQueue();
      }
    }, printTimePerPage);
  }

  triggerPaperJam(jobId: string, atPage: number): void {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return;
    
    this.handlePaperJam(jobId, atPage);
    this.isProcessing = false;
    
    const job2 = getJobById(jobId);
    if (job2) {
      const printers = getIdlePrinters();
      if (printers.length > 0) {
      }
      this.reorderQueue();
      this.processQueue();
    }
  }

  triggerOutOfPaper(jobId: string, atPage: number): void {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return;
    
    this.handleOutOfPaper(jobId, atPage);
    this.isProcessing = false;
    this.reorderQueue();
    this.processQueue();
  }
}

export const printQueueService = new PrintQueueService();
