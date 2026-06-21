import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { printQueueService } from '../services/printQueueService';
import { getJobById, getJobsByStudentId, getAllJobs, getQueuedJobs, getActiveJobs } from '../models/printJob';
import { getPricing, calculatePrice, calculateTotalPages } from '../services/pricingService';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

const createJobSchema = z.object({
  studentId: z.string().min(1, '学号不能为空'),
  studentName: z.string().min(1, '姓名不能为空'),
  color: z.enum(['black_white', 'color']),
  side: z.enum(['single', 'double']),
  copies: z.number().int().min(1, '份数至少为1').max(100, '份数最多为100'),
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const body = createJobSchema.safeParse({
      ...req.body,
      copies: parseInt(req.body.copies, 10),
    });

    if (!body.success) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: body.error.errors[0].message });
      return;
    }

    const pageCount = estimatePageCount(req.file.originalname, req.file.size);

    const job = await printQueueService.createJob({
      studentId: body.data.studentId,
      studentName: body.data.studentName,
      color: body.data.color,
      side: body.data.side,
      copies: body.data.copies,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      pageCount,
    });

    res.status(201).json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('创建打印任务失败:', error);
    res.status(500).json({ error: '创建打印任务失败' });
  }
});

function estimatePageCount(fileName: string, fileSize: number): number {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.pdf' || ext === '.doc' || ext === '.docx') {
    return Math.max(1, Math.floor(fileSize / 50000));
  } else if (ext === '.txt') {
    return Math.max(1, Math.floor(fileSize / 2000));
  } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    return 1;
  }
  
  return 1;
}

const calculateSchema = z.object({
  pageCount: z.number().int().min(1),
  color: z.enum(['black_white', 'color']),
  side: z.enum(['single', 'double']),
  copies: z.number().int().min(1),
});

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const body = calculateSchema.safeParse(req.body);
    
    if (!body.success) {
      res.status(400).json({ error: '参数错误' });
      return;
    }

    const { pageCount, color, side, copies } = body.data;
    const price = calculatePrice(pageCount, color, side, copies);
    const totalPages = calculateTotalPages(pageCount, side, copies);

    res.json({
      success: true,
      price,
      totalPages,
      pricing: getPricing(),
    });
  } catch (error) {
    console.error('计算费用失败:', error);
    res.status(500).json({ error: '计算费用失败' });
  }
});

router.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const job = getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }

    res.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('获取任务失败:', error);
    res.status(500).json({ error: '获取任务失败' });
  }
});

router.get('/jobs', (req: Request, res: Response) => {
  try {
    const { studentId, status, limit } = req.query;
    
    let jobs;
    if (studentId) {
      jobs = getJobsByStudentId(studentId as string, limit ? parseInt(limit as string, 10) : 20);
    } else {
      jobs = getAllJobs(limit ? parseInt(limit as string, 10) : 50);
    }

    res.json({
      success: true,
      jobs,
      total: jobs.length,
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

router.get('/queue', (req: Request, res: Response) => {
  try {
    const jobs = getActiveJobs();
    res.json({
      success: true,
      queue: jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('获取队列失败:', error);
    res.status(500).json({ error: '获取队列失败' });
  }
});

router.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const job = await printQueueService.cancelJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: '任务不存在' });
      return;
    }

    res.json({
      success: true,
      job,
      message: job.refundStatus === 'pending' || job.refundStatus === 'processed'
        ? `取消成功，退款金额：¥${job.refundAmount}`
        : '取消成功',
    });
  } catch (error) {
    console.error('取消任务失败:', error);
    res.status(500).json({ error: '取消任务失败' });
  }
});

router.post('/jobs/:id/paper-jam', async (req: Request, res: Response) => {
  try {
    const { atPage } = req.body;
    const job = await printQueueService.triggerPaperJam(req.params.id, atPage || 0);
    
    if (!job) {
      res.status(400).json({ 
        success: false,
        error: '任务不存在或不在打印中' 
      });
      return;
    }

    res.json({
      success: true,
      message: `卡纸！已打印 ${job.printedPages}/${job.totalPages} 页，退款 ¥${job.refundAmount}`,
      job,
      refund: {
        amount: job.refundAmount,
        status: job.refundStatus,
      },
    });
  } catch (error) {
    console.error('模拟卡纸失败:', error);
    res.status(500).json({ error: '模拟卡纸失败' });
  }
});

router.post('/jobs/:id/out-of-paper', async (req: Request, res: Response) => {
  try {
    const { atPage } = req.body;
    const job = await printQueueService.triggerOutOfPaper(req.params.id, atPage || 0);
    
    if (!job) {
      res.status(400).json({ 
        success: false,
        error: '任务不存在或不在打印中' 
      });
      return;
    }

    res.json({
      success: true,
      message: `缺纸！已打印 ${job.printedPages}/${job.totalPages} 页，退款 ¥${job.refundAmount}`,
      job,
      refund: {
        amount: job.refundAmount,
        status: job.refundStatus,
      },
    });
  } catch (error) {
    console.error('模拟缺纸失败:', error);
    res.status(500).json({ error: '模拟缺纸失败' });
  }
});

router.get('/pricing', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      pricing: getPricing(),
    });
  } catch (error) {
    console.error('获取价格失败:', error);
    res.status(500).json({ error: '获取价格失败' });
  }
});

export default router;
