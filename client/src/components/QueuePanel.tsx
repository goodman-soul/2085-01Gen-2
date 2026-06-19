import { useState, useEffect } from 'react';
import { PrintJob } from '../types';
import { getQueue, cancelJob, triggerPaperJam, triggerOutOfPaper } from '../services/api';

interface QueuePanelProps {
  refreshTrigger: number;
}

export default function QueuePanel({ refreshTrigger }: QueuePanelProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(loadQueue, 2000);
    return () => clearInterval(interval);
  }, []);

  async function loadQueue() {
    try {
      const data = await getQueue();
      setJobs(data);
    } catch (error) {
      console.error('加载队列失败:', error);
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm('确定要取消这个打印任务吗？')) return;
    
    try {
      await cancelJob(jobId);
      loadQueue();
    } catch (error) {
      console.error('取消任务失败:', error);
      alert('取消任务失败');
    }
  }

  async function handlePaperJam(jobId: string) {
    try {
      await triggerPaperJam(jobId, 3);
      loadQueue();
    } catch (error) {
      console.error('模拟卡纸失败:', error);
    }
  }

  async function handleOutOfPaper(jobId: string) {
    try {
      await triggerOutOfPaper(jobId, 5);
      loadQueue();
    } catch (error) {
      console.error('模拟缺纸失败:', error);
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      queued: '排队中',
      printing: '打印中',
      completed: '已完成',
      cancelled: '已取消',
      paper_jam: '卡纸',
      out_of_paper: '缺纸',
      failed: '失败',
      pending: '待处理',
    };
    return labels[status] || status;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'printing');

  return (
    <div className="card">
      <h2 className="card-title">打印队列 ({activeJobs.length})</h2>
      
      {activeJobs.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-icon">📋</div>
          <p>暂无打印任务</p>
        </div>
      ) : (
        <div className="queue-list">
          {activeJobs.map(job => (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <span className="job-file-name" title={job.fileName}>
                  {job.queuePosition && `#${job.queuePosition} `}
                  {job.fileName}
                </span>
                <span className={`job-status status-${job.status}`}>
                  {getStatusLabel(job.status)}
                </span>
              </div>
              
              <div className="job-info">
                <span className="job-tag">
                  {job.color === 'black_white' ? '黑白' : '彩色'}
                </span>
                <span className="job-tag">
                  {job.side === 'single' ? '单面' : '双面'}
                </span>
                <span className="job-tag">{job.copies} 份</span>
                <span className="job-tag">共 {job.totalPages} 页</span>
              </div>
              
              {job.status === 'printing' && (
                <>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(job.printedPages / job.totalPages) * 100}%` }}
                    />
                  </div>
                  <div className="progress-text">
                    已打印 {job.printedPages} / {job.totalPages} 页
                  </div>
                </>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                <span className="job-amount">¥{job.amount.toFixed(2)}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {job.status === 'printing' && (
                    <>
                      <button 
                        className="btn btn-small" 
                        style={{ backgroundColor: '#ffc107', color: '#856404' }}
                        onClick={() => handlePaperJam(job.id)}
                      >
                        模拟卡纸
                      </button>
                      <button 
                        className="btn btn-small"
                        style={{ backgroundColor: '#fd7e14', color: 'white' }}
                        onClick={() => handleOutOfPaper(job.id)}
                      >
                        模拟缺纸
                      </button>
                    </>
                  )}
                  {(job.status === 'queued' || job.status === 'printing') && (
                    <button 
                      className="btn btn-danger btn-small"
                      onClick={() => handleCancel(job.id)}
                    >
                      取消
                    </button>
                  )}
                </div>
              </div>
              
              {job.refundStatus === 'pending' && (
                <div className="job-refund">⏳ 退款处理中: ¥{job.refundAmount.toFixed(2)}</div>
              )}
              {job.refundStatus === 'processed' && job.refundAmount > 0 && (
                <div className="job-refund">✅ 已退款: ¥{job.refundAmount.toFixed(2)}</div>
              )}
              {job.failureMessage && (
                <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '6px' }}>
                  ⚠️ {job.failureMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
