import express from 'express';
import cors from 'cors';
import printRoutes from './routes/printRoutes';
import { initDatabase } from './database';
import { createPrinter, getAllPrinters } from './models/printer';
import { printQueueService } from './services/printQueueService';

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/print', printRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/printers', (req, res) => {
  const printers = getAllPrinters();
  res.json({
    success: true,
    printers,
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    error: err.message || '服务器内部错误',
  });
});

function initPrinters() {
  const printers = getAllPrinters();
  if (printers.length === 0) {
    createPrinter('printer-1', '打印机 1 号');
    createPrinter('printer-2', '打印机 2 号');
    console.log('已初始化 2 台打印机');
  }
}

export function startServer() {
  initDatabase();
  initPrinters();

  printQueueService.on('jobQueued', (job) => {
    console.log(`[队列] 任务已排队: ${job.id} - ${job.fileName}`);
  });

  printQueueService.on('jobStarted', (job, printer) => {
    console.log(`[打印] 开始打印: ${job.id} - ${printer.name}`);
  });

  printQueueService.on('jobCompleted', (job) => {
    console.log(`[完成] 打印完成: ${job.id} - 扣费 ¥${job.amount}`);
  });

  printQueueService.on('jobCancelled', (job, refundAmount) => {
    console.log(`[取消] 任务已取消: ${job.id} - 退款 ¥${refundAmount}`);
  });

  printQueueService.on('paperJam', (job, printedPages, refundAmount) => {
    console.log(`[异常] 卡纸: ${job.id} - 已打印 ${printedPages} 页 - 退款 ¥${refundAmount}`);
  });

  printQueueService.on('outOfPaper', (job, printedPages, refundAmount) => {
    console.log(`[异常] 缺纸: ${job.id} - 已打印 ${printedPages} 页 - 退款 ¥${refundAmount}`);
  });

  printQueueService.on('refundProcessed', (job, refundAmount) => {
    console.log(`[退款] 退款已处理: ${job.id} - ¥${refundAmount}`);
  });

  app.listen(PORT, () => {
    console.log(`校园自助打印系统服务已启动`);
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 文档: http://localhost:${PORT}/api/health`);
  });

  return app;
}

if (require.main === module) {
  startServer();
}

export default app;
