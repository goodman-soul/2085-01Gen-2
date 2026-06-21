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
import { getIdlePrinters, updatePrinterStatus, updatePrinterPaperLevel, getPrinterById } from '../models/printer';
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
  private printTimers: Map<string, NodeJS.Timeout> = new Map();
  private jobPrinters: Map<string, string> = new Map();

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
    setImmediate(() => this.processQueue());

    return job;
  }

  async cancelJob(jobId: string, reason: string = 'user_cancelled'): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job) return null;

    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
      return job;
    }

    const printerId = this.jobPrinters.get(jobId);
    
    this.clearPrintTimer(jobId);

    if (job.status === 'printing') {
      const refundAmount = calculateRefundAmount(job.amount, job.totalPages, job.printedPages);
      updateJobStatus(jobId, 'cancelled', {
        failureReason: reason as FailureReason,
        failureMessage: '用户取消打印',
        printedPages: job.printedPages,
      });
      updateJobRefund(jobId, refundAmount > 0 ? 'pending' : 'none', refundAmount);
      this.emit('jobCancelled', job, refundAmount);
      
      if (refundAmount > 0) {
        this.processRefund(jobId, refundAmount);
      }
    } else if (job.status === 'queued') {
      updateJobStatus(jobId, 'cancelled', {
        failureReason: reason as FailureReason,
        failureMessage: '用户取消打印',
      });
      updateJobRefund(jobId, 'none', 0);
      this.emit('jobCancelled', job, 0);
    }

    if (printerId) {
      updatePrinterStatus(printerId, 'idle');
      this.jobPrinters.delete(jobId);
    }

    this.isProcessing = false;
    this.reorderQueue();
    setImmediate(() => this.processQueue());

    return getJobById(jobId);
  }

  async handlePaperJam(jobId: string, printedPages: number): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return null;

    const printerId = this.jobPrinters.get(jobId);
    
    this.clearPrintTimer(jobId);

    const actualPrintedPages = Math.max(0, Math.min(printedPages, job.totalPages));
    const refundAmount = calculateRefundAmount(job.amount, job.totalPages, actualPrintedPages);
    
    updateJobStatus(jobId, 'paper_jam', {
      failureReason: 'paper_jam',
      failureMessage: '打印机卡纸，打印中断',
      printedPages: actualPrintedPages,
    });
    updateJobRefund(jobId, refundAmount > 0 ? 'pending' : 'none', refundAmount);
    
    this.emit('paperJam', job, actualPrintedPages, refundAmount);
    console.log(`[卡纸] 任务 ${jobId}: 已打印 ${actualPrintedPages}/${job.totalPages} 页, 应退款 ¥${refundAmount}`);
    
    if (refundAmount > 0) {
      this.processRefund(jobId, refundAmount);
    }

    if (printerId) {
      updatePrinterStatus(printerId, 'error', undefined, '卡纸，需要清理');
      this.jobPrinters.delete(jobId);
      
      setTimeout(() => {
        updatePrinterStatus(printerId, 'idle');
        console.log(`[打印机恢复] ${printerId} 卡纸已清理`);
      }, 3000);
    }

    this.isProcessing = false;
    this.reorderQueue();
    setImmediate(() => this.processQueue());

    return getJobById(jobId);
  }

  async handleOutOfPaper(jobId: string, printedPages: number): Promise<PrintJob | null> {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') return null;

    const printerId = this.jobPrinters.get(jobId);
    
    this.clearPrintTimer(jobId);

    const actualPrintedPages = Math.max(0, Math.min(printedPages, job.totalPages));
    const refundAmount = calculateRefundAmount(job.amount, job.totalPages, actualPrintedPages);
    
    updateJobStatus(jobId, 'out_of_paper', {
      failureReason: 'out_of_paper',
      failureMessage: '打印机缺纸，请补充纸张',
      printedPages: actualPrintedPages,
    });
    updateJobRefund(jobId, refundAmount > 0 ? 'pending' : 'none', refundAmount);
    
    this.emit('outOfPaper', job, actualPrintedPages, refundAmount);
    console.log(`[缺纸] 任务 ${jobId}: 已打印 ${actualPrintedPages}/${job.totalPages} 页, 应退款 ¥${refundAmount}`);
    
    if (refundAmount > 0) {
      this.processRefund(jobId, refundAmount);
    }

    if (printerId) {
      updatePrinterStatus(printerId, 'error', undefined, '缺纸，需要补充纸张');
      this.jobPrinters.delete(jobId);
      
      setTimeout(() => {
        updatePrinterStatus(printerId, 'idle');
        console.log(`[打印机恢复] ${printerId} 纸张已补充`);
      }, 3000);
    }

    this.isProcessing = false;
    this.reorderQueue();
    setImmediate(() => this.processQueue());

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
    console.log(`[完成] 任务 ${jobId}: 扣费 ¥${job.amount}`);

    const printerId = this.jobPrinters.get(jobId);
    if (printerId) {
      updatePrinterStatus(printerId, 'idle');
      this.jobPrinters.delete(jobId);
    }

    this.isProcessing = false;
    this.reorderQueue();
    setImmediate(() => this.processQueue());

    return getJobById(jobId);
  }

  private processRefund(jobId: string, refundAmount: number): void {
    setTimeout(() => {
      const job = getJobById(jobId);
      if (!job) return;

      if (refundAmount > 0) {
        updateJobRefund(jobId, 'processed', refundAmount);
        this.emit('refundProcessed', job, refundAmount);
        console.log(`[退款完成] 任务 ${jobId}: 退款 ¥${refundAmount} 已处理`);
      } else {
        updateJobRefund(jobId, 'none', 0);
      }
    }, 1500);
  }

  private clearPrintTimer(jobId: string): void {
    const timer = this.printTimers.get(jobId);
    if (timer) {
      clearInterval(timer);
      this.printTimers.delete(jobId);
    }
  }

  private reorderQueue(): void {
    const queuedJobs = getQueuedJobs();
    queuedJobs.forEach((job, index) => {
      updateQueuePosition(job.id, index + 1);
    });
  }

  processQueue(): void {
    if (this.isProcessing) {
      return;
    }

    const idlePrinters = getIdlePrinters();
    if (idlePrinters.length === 0) {
      return;
    }

    const queuedJobs = getQueuedJobs();
    if (queuedJobs.length === 0) {
      return;
    }

    this.isProcessing = true;

    const printer = idlePrinters[0];
    const job = queuedJobs[0];

    updatePrinterStatus(printer.id, 'busy', job.id);
    updateJobStatus(job.id, 'printing', {
      startedAt: new Date().toISOString(),
    });
    updateQueuePosition(job.id, null);
    this.jobPrinters.set(job.id, printer.id);

    this.emit('jobStarted', job, printer);
    console.log(`[开始打印] 任务 ${job.id} 在 ${printer.name} 上开始`);

    this.simulatePrinting(job.id, printer.id);
  }

  private simulatePrinting(jobId: string, printerId: string): void {
    const job = getJobById(jobId);
    if (!job) {
      this.isProcessing = false;
      return;
    }

    let printedPages = job.printedPages;
    const totalPages = job.totalPages;
    const printTimePerPage = 500;

    const printInterval = setInterval(() => {
      const currentJob = getJobById(jobId);
      
      if (!currentJob) {
        this.clearPrintTimer(jobId);
        this.isProcessing = false;
        updatePrinterStatus(printerId, 'idle');
        this.jobPrinters.delete(jobId);
        return;
      }

      if (currentJob.status !== 'printing') {
        this.clearPrintTimer(jobId);
        this.isProcessing = false;
        updatePrinterStatus(printerId, 'idle');
        this.jobPrinters.delete(jobId);
        return;
      }

      printedPages++;
      updateJobStatus(jobId, 'printing', { printedPages });
      
      this.emit('printProgress', jobId, printedPages, totalPages);

      if (printedPages >= totalPages) {
        this.clearPrintTimer(jobId);
        this.completeJob(jobId);
      }
    }, printTimePerPage);

    this.printTimers.set(jobId, printInterval);
  }

  triggerPaperJam(jobId: string, atPage: number): PrintJob | null {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') {
      return null;
    }
    
    const actualPage = atPage > 0 ? atPage : Math.max(1, Math.floor(job.totalPages / 2));
    console.log(`[触发卡纸] 任务 ${jobId} 在第 ${actualPage} 页`);
    return this.handlePaperJam(jobId, actualPage);
  }

  triggerOutOfPaper(jobId: string, atPage: number): PrintJob | null {
    const job = getJobById(jobId);
    if (!job || job.status !== 'printing') {
      return null;
    }
    
    const actualPage = atPage > 0 ? atPage : Math.max(1, Math.floor(job.totalPages / 2));
    console.log(`[触发缺纸] 任务 ${jobId} 在第 ${actualPage} 页`);
    return this.handleOutOfPaper(jobId, actualPage);
  }
}

export const printQueueService = new PrintQueueService();
