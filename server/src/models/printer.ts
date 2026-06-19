import { getDb } from '../database';
import { PrinterStatus } from '../types';

function rowToPrinter(row: any): PrinterStatus {
  return {
    id: row.id,
    name: row.name,
    status: row.status as 'idle' | 'busy' | 'error',
    currentJobId: row.current_job_id,
    paperLevel: row.paper_level,
    errorMessage: row.error_message,
  };
}

export function createPrinter(id: string, name: string): PrinterStatus {
  const db = getDb();
  db.prepare(`
    INSERT INTO printers (id, name, status, paper_level)
    VALUES (?, ?, 'idle', 100)
  `).run(id, name);
  return getPrinterById(id)!;
}

export function getPrinterById(id: string): PrinterStatus | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM printers WHERE id = ?').get(id);
  return row ? rowToPrinter(row) : null;
}

export function getAllPrinters(): PrinterStatus[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM printers ORDER BY name').all();
  return rows.map(rowToPrinter);
}

export function updatePrinterStatus(
  id: string,
  status: 'idle' | 'busy' | 'error',
  currentJobId?: string,
  errorMessage?: string
): PrinterStatus | null {
  const db = getDb();
  db.prepare(`
    UPDATE printers 
    SET status = ?, current_job_id = ?, error_message = ?
    WHERE id = ?
  `).run(status, currentJobId ?? null, errorMessage ?? null, id);
  return getPrinterById(id);
}

export function updatePrinterPaperLevel(id: string, paperLevel: number): PrinterStatus | null {
  const db = getDb();
  db.prepare(`
    UPDATE printers 
    SET paper_level = ?
    WHERE id = ?
  `).run(paperLevel, id);
  return getPrinterById(id);
}

export function getIdlePrinters(): PrinterStatus[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM printers 
    WHERE status = 'idle' 
    ORDER BY name
  `).all();
  return rows.map(rowToPrinter);
}
