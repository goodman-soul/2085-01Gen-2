import { useState } from 'react';
import PrintForm from './components/PrintForm';
import QueuePanel from './components/QueuePanel';
import HistoryPanel from './components/HistoryPanel';

function App() {
  const [studentId, setStudentId] = useState('2024001');
  const [studentName, setStudentName] = useState('张三');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleJobCreated() {
    setRefreshTrigger(prev => prev + 1);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🖨️ 校园自助打印系统</h1>
        <p>便捷、高效、透明的自助打印服务</p>
      </header>

      <div className="student-id-input">
        <div style={{ flex: 1 }}>
          <label className="form-label">学号</label>
          <input 
            type="text" 
            className="form-input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="请输入学号"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label">姓名</label>
          <input 
            type="text" 
            className="form-input"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="请输入姓名"
          />
        </div>
      </div>

      <main className="app-main">
        <PrintForm 
          studentId={studentId}
          studentName={studentName}
          onJobCreated={handleJobCreated}
        />
        <QueuePanel refreshTrigger={refreshTrigger} />
      </main>

      <div style={{ marginTop: '24px' }}>
        <HistoryPanel 
          studentId={studentId}
          refreshTrigger={refreshTrigger}
        />
      </div>

      <div style={{ marginTop: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
        <p>计费规则：黑白单面 ¥0.10/页 | 黑白双面 ¥0.15/页 | 彩色单面 ¥1.00/页 | 彩色双面 ¥1.50/页</p>
        <p style={{ marginTop: '6px' }}>打印完成后扣费，异常情况自动按比例退款</p>
      </div>
    </div>
  );
}

export default App;
