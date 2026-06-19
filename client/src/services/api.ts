import axios from 'axios';
import { PrintJob, PricingConfig, PrinterStatus, PrintColor, PrintSide } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export interface CreateJobParams {
  studentId: string;
  studentName: string;
  color: PrintColor;
  side: PrintSide;
  copies: number;
  file: File;
}

export async function createPrintJob(params: CreateJobParams): Promise<PrintJob> {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('studentId', params.studentId);
  formData.append('studentName', params.studentName);
  formData.append('color', params.color);
  formData.append('side', params.side);
  formData.append('copies', params.copies.toString());

  const response = await api.post('/print/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.job;
}

export async function calculatePrice(
  pageCount: number,
  color: PrintColor,
  side: PrintSide,
  copies: number
): Promise<{ price: number; totalPages: number; pricing: PricingConfig }> {
  const response = await api.post('/print/calculate', {
    pageCount,
    color,
    side,
    copies,
  });
  return response.data;
}

export async function getJob(id: string): Promise<PrintJob> {
  const response = await api.get(`/print/jobs/${id}`);
  return response.data.job;
}

export async function getJobs(studentId?: string, limit: number = 20): Promise<PrintJob[]> {
  const params: any = { limit };
  if (studentId) params.studentId = studentId;
  
  const response = await api.get('/print/jobs', { params });
  return response.data.jobs;
}

export async function getQueue(): Promise<PrintJob[]> {
  const response = await api.get('/print/queue');
  return response.data.queue;
}

export async function cancelJob(id: string): Promise<PrintJob> {
  const response = await api.post(`/print/jobs/${id}/cancel`);
  return response.data.job;
}

export async function getPricing(): Promise<PricingConfig> {
  const response = await api.get('/print/pricing');
  return response.data.pricing;
}

export async function getPrinters(): Promise<PrinterStatus[]> {
  const response = await api.get('/printers');
  return response.data.printers;
}

export async function triggerPaperJam(jobId: string, atPage: number): Promise<void> {
  await api.post(`/print/jobs/${jobId}/paper-jam`, { atPage });
}

export async function triggerOutOfPaper(jobId: string, atPage: number): Promise<void> {
  await api.post(`/print/jobs/${jobId}/out-of-paper`, { atPage });
}

export default api;
