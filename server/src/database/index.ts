import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function initDatabase(dbPath?: string): Database.Database {
  const dbFile = dbPath || path.join(process.cwd(), 'data', 'print-system.db');
  
  const dbDir = path.dirname(dbFile);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      page_count INTEGER NOT NULL,
      color TEXT NOT NULL,
      side TEXT NOT NULL,
      copies INTEGER NOT NULL,
      total_pages INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      amount REAL NOT NULL DEFAULT 0,
      paid INTEGER NOT NULL DEFAULT 0,
      refund_status TEXT NOT NULL DEFAULT 'none',
      refund_amount REAL NOT NULL DEFAULT 0,
      failure_reason TEXT,
      failure_message TEXT,
      queue_position INTEGER,
      printed_pages INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_student_id ON print_jobs(student_id);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);

    CREATE TABLE IF NOT EXISTS printers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      current_job_id TEXT,
      paper_level INTEGER NOT NULL DEFAULT 100,
      error_message TEXT,
      FOREIGN KEY (current_job_id) REFERENCES print_jobs(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES print_jobs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON transactions(job_id);
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
