import { useState, useRef } from 'react';
import { PrintColor, PrintSide, PricingConfig } from '../types';
import { createPrintJob, calculatePrice, getPricing } from '../services/api';

interface PrintFormProps {
  studentId: string;
  studentName: string;
  onJobCreated: () => void;
}

export default function PrintForm({ studentId, studentName, onJobCreated }: PrintFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [color, setColor] = useState<PrintColor>('black_white');
  const [side, setSide] = useState<PrintSide>('single');
  const [copies, setCopies] = useState(1);
  const [priceInfo, setPriceInfo] = useState<{ price: number; totalPages: number } | null>(null);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadPricing() {
    try {
      const data = await getPricing();
      setPricing(data);
    } catch (error) {
      console.error('加载价格失败:', error);
    }
  }

  function estimatePageCount(file: File): number {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const size = file.size;
    
    if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
      return Math.max(1, Math.floor(size / 50000));
    } else if (ext === 'txt') {
      return Math.max(1, Math.floor(size / 2000));
    } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      return 1;
    }
    return 1;
  }

  async function handleFileSelect(file: File) {
    setFile(file);
    const estimatedPages = estimatePageCount(file);
    setPageCount(estimatedPages);
    updatePrice(estimatedPages, color, side, copies);
  }

  async function updatePrice(pages: number, c: PrintColor, s: PrintSide, cp: number) {
    try {
      const result = await calculatePrice(pages, c, s, cp);
      setPriceInfo({ price: result.price, totalPages: result.totalPages });
    } catch (error) {
      console.error('计算价格失败:', error);
    }
  }

  function handleColorChange(newColor: PrintColor) {
    setColor(newColor);
    if (file) {
      updatePrice(pageCount, newColor, side, copies);
    }
  }

  function handleSideChange(newSide: PrintSide) {
    setSide(newSide);
    if (file) {
      updatePrice(pageCount, color, newSide, copies);
    }
  }

  function handleCopiesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value, 10);
    const newCopies = Math.max(1, Math.min(100, isNaN(value) ? 1 : value));
    setCopies(newCopies);
    if (file) {
      updatePrice(pageCount, color, side, newCopies);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  function clearFile() {
    setFile(null);
    setPriceInfo(null);
    setPageCount(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!file) {
      alert('请选择要打印的文件');
      return;
    }

    if (!studentId || !studentName) {
      alert('请填写学号和姓名');
      return;
    }

    setUploading(true);
    try {
      await createPrintJob({
        studentId,
        studentName,
        color,
        side,
        copies,
        file,
      });
      
      clearFile();
      setCopies(1);
      setColor('black_white');
      setSide('single');
      onJobCreated();
      alert('打印任务已提交！');
    } catch (error: any) {
      console.error('提交打印任务失败:', error);
      alert(error.response?.data?.error || '提交打印任务失败');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">文件打印</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">选择文件</label>
          
          {!file ? (
            <div 
              className={`file-upload ${dragOver ? 'dragging' : ''}`}
              onClick={handleClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="file-upload-icon">📄</div>
              <div className="file-upload-text">
                点击或拖拽文件到此处上传
              </div>
              <div className="file-upload-hint">
                支持 PDF、Word、TXT、图片等格式
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                style={{ display: 'none' }}
                onChange={handleInputChange}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              />
            </div>
          ) : (
            <div>
              <div className="file-info">
                <span style={{ fontSize: '24px' }}>📄</span>
                <span className="file-name" title={file.name}>{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-small"
                  onClick={clearFile}
                >
                  更换
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                预估页数: {pageCount} 页
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">颜色选择</label>
          <div className="radio-group">
            <div className="radio-option">
              <input 
                type="radio" 
                id="color-bw" 
                name="color"
                value="black_white"
                checked={color === 'black_white'}
                onChange={() => handleColorChange('black_white')}
              />
              <label htmlFor="color-bw">黑白</label>
            </div>
            <div className="radio-option">
              <input 
                type="radio" 
                id="color-color" 
                name="color"
                value="color"
                checked={color === 'color'}
                onChange={() => handleColorChange('color')}
              />
              <label htmlFor="color-color">彩色</label>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">打印方式</label>
          <div className="radio-group">
            <div className="radio-option">
              <input 
                type="radio" 
                id="side-single" 
                name="side"
                value="single"
                checked={side === 'single'}
                onChange={() => handleSideChange('single')}
              />
              <label htmlFor="side-single">单面</label>
            </div>
            <div className="radio-option">
              <input 
                type="radio" 
                id="side-double" 
                name="side"
                value="double"
                checked={side === 'double'}
                onChange={() => handleSideChange('double')}
              />
              <label htmlFor="side-double">双面</label>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">打印份数</label>
          <input 
            type="number" 
            className="form-input"
            value={copies}
            onChange={handleCopiesChange}
            min="1"
            max="100"
          />
        </div>

        {priceInfo && (
          <div className="price-summary">
            <div className="price-row">
              <span>单价</span>
              <span>
                {color === 'black_white' 
                  ? (side === 'single' ? '¥0.10/页' : '¥0.15/页')
                  : (side === 'single' ? '¥1.00/页' : '¥1.50/页')
                }
              </span>
            </div>
            <div className="price-row">
              <span>原文档页数</span>
              <span>{pageCount} 页</span>
            </div>
            <div className="price-row">
              <span>总打印页数</span>
              <span>{priceInfo.totalPages} 页</span>
            </div>
            <div className="price-row">
              <span>份数</span>
              <span>{copies} 份</span>
            </div>
            <div className="price-row">
              <span>总费用</span>
              <span>¥{priceInfo.price.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button 
          type="submit" 
          className="btn btn-primary"
          style={{ marginTop: '20px' }}
          disabled={!file || uploading}
        >
          {uploading ? '提交中...' : '提交打印'}
        </button>
      </form>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
