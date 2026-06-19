import { useState, useEffect } from 'react';
import { PrintJob } from '../types';
import { getJobs, cancelJob } from '../services/api';

interface HistoryPanelProps {
  studentId: string;
  refreshTrigger: number;
}

export default function HistoryPanel({ studentId, refreshTrigger }: HistoryPanelProps) {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled' | 'failed'>('all');

  useEffect(() => {
    loadHistory();
  }, [studentId, refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [studentId]);

  async function loadHistory() {
    if (!studentId) return;
    
    setLoading(true);
    try {
      const data = await getJobs(studentId, 20);
      setJobs(data);
    } catch (error) {
      console.error('加载历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(jobId: string) {
    if (!confirm('确定要取消这个打印任务吗？')) return;
    
    try {
      await cancelJob(jobId);
      loadHistory();
    } catch (error) {
      console.error('取消任务失败:', error);
      alert('取消任务失败');
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

  function getStatusIcon(status: string) {
    const icons: Record<string, string> = {
      queued: '📋',
      printing: '🖨️',
      completed: '✅',
      cancelled: '❌',
      paper_jam: '⚠️',
      out_of_paper: '📭',
      failed: '❌',
      pending: '⏳',
    };
    return icons[status] || '📄';
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'cancelled') return job.status === 'cancelled';
    if (filter === 'failed') 
      return job.status === 'paper_jam' || job.status === 'out_of_paper' || job.status === 'failed';
    return true;
  });

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <h2 className="card-title">打印记录</h2>
      
      <div className="tabs">
        <button 
          className={`tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        <button 
          className={`tab ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          已完成
        </button>
        <button 
          className={`tab ${filter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('cancelled')}
        >
          已取消
        </button>
        <button 
          className={`tab ${filter === 'failed' ? 'active' : ''}`}
          onClick={() => setFilter('failed')}
        >
          异常
        </button>
      </div>

      {!studentId ? (
        <div className="queue-empty">
          <p>请先填写学号以查看打印记录</p>
        </div>
      ) : loading && jobs.length === 0 ? (
        <div className="queue-empty">
          <p>加载中...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-icon">📭</div>
          <p>暂无打印记录</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredJobs.map(job => (
            <div key={job.id} className="history-item">
              <div className="history-icon">{getStatusIcon(job.status)}</div>
              <div className="history-info">
                <div className="history-name">{job.fileName}</div>
                <div className="history-time">
                  {formatTime(job.createdAt)} · 
                  {job.color === 'black_white' ? '黑白' : '彩色'} · 
                  {job.side === 'single' ? '单面' : '双面'} · 
                  {job.copies} 份
                </div>
                {job.failureMessage && (
                  <div style={{ fontSize: '12px', color: '#dc3545', marginTop: '4px' }}>
                    ⚠️ {job.failureMessage}
                  </div>
                )}
                {job.refundStatus === 'processed' && job.refundAmount > 0 && (
                  <div style={{ fontSize: '12px', color: '#28a745', marginTop: '4px' }}>
                    💰 已退款 ¥{job.refundAmount.toFixed(2)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="history-amount">¥{job.amount.toFixed(2)}</div>
                <span className={`job-status status-${job.status}`} style={{ fontSize: '11px' }}>
                  {getStatusLabel(job.status)}
                </span>
                {(job.status === 'queued' || job.status === 'printing') && (
                  <button 
                    className="btn btn-danger btn-small"
                    style={{ marginTop: '8px' }}
                    onClick={() => handleCancel(job.id)}
                  >
                    取消
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
