export type PrintColor = 'black_white' | 'color';
export type PrintSide = 'single' | 'double';
export type PrintStatus = 
  | 'pending' 
  | 'queued' 
  | 'printing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'paper_jam'
  | 'out_of_paper';

export type RefundStatus = 'none' | 'pending' | 'processed' | 'failed';
export type FailureReason = 'paper_jam' | 'out_of_paper' | 'user_cancelled' | 'printer_error';

export interface PrintJob {
  id: string;
  studentId: string;
  studentName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
  color: PrintColor;
  side: PrintSide;
  copies: number;
  totalPages: number;
  status: PrintStatus;
  amount: number;
  paid: boolean;
  refundStatus: RefundStatus;
  refundAmount: number;
  failureReason?: FailureReason;
  failureMessage?: string;
  queuePosition?: number;
  printedPages: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PrintJobCreateInput {
  studentId: string;
  studentName: string;
  color: PrintColor;
  side: PrintSide;
  copies: number;
}

export interface PricingConfig {
  blackWhiteSingle: number;
  blackWhiteDouble: number;
  colorSingle: number;
  colorDouble: number;
}

export interface PrinterStatus {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error';
  currentJobId?: string;
  paperLevel: number;
  errorMessage?: string;
}

export interface PrintQueue {
  jobs: PrintJob[];
  totalCount: number;
}
