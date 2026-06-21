import { getDb } from '../database';
import { PrintJob, PrintStatus, RefundStatus, FailureReason } from '../types';

function rowToJob(row: any): PrintJob {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    pageCount: row.page_count,
    color: row.color,
    side: row.side,
    copies: row.copies,
    totalPages: row.total_pages,
    status: row.status as PrintStatus,
    amount: row.amount,
    paid: !!row.paid,
    refundStatus: row.refund_status as RefundStatus,
    refundAmount: row.refund_amount,
    failureReason: row.failure_reason as FailureReason | undefined,
    failureMessage: row.failure_message,
    queuePosition: row.queue_position,
    printedPages: row.printed_pages,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export interface CreateJobData {
  id: string;
  studentId: string;
  studentName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  pageCount: number;
  color: string;
  side: string;
  copies: number;
  totalPages: number;
  amount: number;
  status: PrintStatus;
  queuePosition?: number;
}

export function createJob(data: CreateJobData): PrintJob {
  const db = getDb();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO print_jobs 
    (id, student_id, student_name, file_name, file_path, file_size, page_count, 
     color, side, copies, total_pages, status, amount, paid, refund_status, 
     refund_amount, queue_position, printed_pages, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'none', 0, ?, 0, ?, ?)
  `);
  
  stmt.run(
    data.id,
    data.studentId,
    data.studentName,
    data.fileName,
    data.filePath,
    data.fileSize,
    data.pageCount,
    data.color,
    data.side,
    data.copies,
    data.totalPages,
    data.status,
    data.amount,
    data.queuePosition ?? null,
    now,
    now
  );
  
  return getJobById(data.id)!;
}

export function getJobById(id: string): PrintJob | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id);
  return row ? rowToJob(row) : null;
}

export function getJobsByStudentId(studentId: string, limit: number = 20): PrintJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM print_jobs 
    WHERE student_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(studentId, limit);
  return rows.map(rowToJob);
}

export function getJobsByStatus(status: PrintStatus): PrintJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM print_jobs 
    WHERE status = ? 
    ORDER BY created_at ASC
  `).all(status);
  return rows.map(rowToJob);
}

export function getQueuedJobs(): PrintJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM print_jobs 
    WHERE status = 'queued' 
    ORDER BY queue_position ASC, created_at ASC
  `).all();
  return rows.map(rowToJob);
}

export function getActiveJobs(): PrintJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM print_jobs 
    WHERE status IN ('queued', 'printing') 
    ORDER BY 
      CASE status 
        WHEN 'printing' THEN 0 
        ELSE 1 
      END,
      queue_position ASC, 
      created_at ASC
  `).all();
  return rows.map(rowToJob);
}

export function updateJobStatus(
  id: string, 
  status: PrintStatus, 
  extra?: {
    failureReason?: FailureReason;
    failureMessage?: string;
    printedPages?: number;
    startedAt?: string;
    completedAt?: string;
  }
): PrintJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  let sql = 'UPDATE print_jobs SET status = ?, updated_at = ?';
  const params: any[] = [status, now];
  
  if (extra?.failureReason !== undefined) {
    sql += ', failure_reason = ?';
    params.push(extra.failureReason);
  }
  if (extra?.failureMessage !== undefined) {
    sql += ', failure_message = ?';
    params.push(extra.failureMessage);
  }
  if (extra?.printedPages !== undefined) {
    sql += ', printed_pages = ?';
    params.push(extra.printedPages);
  }
  if (extra?.startedAt !== undefined) {
    sql += ', started_at = ?';
    params.push(extra.startedAt);
  }
  if (extra?.completedAt !== undefined) {
    sql += ', completed_at = ?';
    params.push(extra.completedAt);
  }
  
  sql += ' WHERE id = ?';
  params.push(id);
  
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  
  if (result.changes === 0) return null;
  return getJobById(id);
}

export function updateJobPaid(id: string, paid: boolean): PrintJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE print_jobs 
    SET paid = ?, updated_at = ?
    WHERE id = ?
  `).run(paid ? 1 : 0, now, id);
  
  return getJobById(id);
}

export function updateJobRefund(
  id: string, 
  refundStatus: RefundStatus, 
  refundAmount: number
): PrintJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE print_jobs 
    SET refund_status = ?, refund_amount = ?, updated_at = ?
    WHERE id = ?
  `).run(refundStatus, refundAmount, now, id);
  
  return getJobById(id);
}

export function updateQueuePosition(id: string, position: number | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE print_jobs 
    SET queue_position = ?
    WHERE id = ?
  `).run(position, id);
}

export function getAllJobs(limit: number = 50): PrintJob[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM print_jobs 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit);
  return rows.map(rowToJob);
}

export function getQueueCount(): number {
  const db = getDb();
  const row: any = db.prepare(`
    SELECT COUNT(*) as count FROM print_jobs WHERE status = 'queued'
  `).get();
  return row.count;
}
