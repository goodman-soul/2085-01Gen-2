const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000/api';

async function testExceptionScenarios() {
  console.log('=== 异常场景与退款测试 ===\n');

  const testFile = path.join(__dirname, 'test-files', 'test-large.txt');
  
  if (!fs.existsSync(path.dirname(testFile))) {
    fs.mkdirSync(path.dirname(testFile));
  }
  
  const content = '测试文档内容行\n'.repeat(200);
  fs.writeFileSync(testFile, content);

  try {
    console.log('1. 创建多个打印任务测试队列...');
    
    const jobs = [];
    for (let i = 1; i <= 3; i++) {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(testFile));
      formData.append('studentId', '2024002');
      formData.append('studentName', '李四');
      formData.append('color', i % 2 === 0 ? 'color' : 'black_white');
      formData.append('side', 'single');
      formData.append('copies', '2');

      const res = await axios.post(`${BASE_URL}/print/upload`, formData, {
        headers: formData.getHeaders(),
      });
      jobs.push(res.data.job);
      console.log(`   ✓ 任务 ${i}: ${res.data.job.id} - ¥${res.data.job.amount}`);
    }

    await new Promise(r => setTimeout(r, 1000));

    console.log('\n2. 测试取消排队中的任务...');
    const queueRes = await axios.get(`${BASE_URL}/print/queue`);
    const queuedJobs = queueRes.data.queue.filter(j => j.status === 'queued');
    
    if (queuedJobs.length > 0) {
      const jobToCancel = queuedJobs[0];
      const cancelRes = await axios.post(`${BASE_URL}/print/jobs/${jobToCancel.id}/cancel`);
      console.log(`   ✓ 已取消任务: ${jobToCancel.id}`);
      console.log(`     退款状态: ${cancelRes.data.job.refundStatus}`);
      console.log(`     退款金额: ¥${cancelRes.data.job.refundAmount}`);
    }

    await new Promise(r => setTimeout(r, 2000));

    console.log('\n3. 查看当前队列状态...');
    const queueRes2 = await axios.get(`${BASE_URL}/print/queue`);
    console.log(`   ✓ 队列中任务数: ${queueRes2.data.count}`);
    queueRes2.data.queue.forEach((job, index) => {
      console.log(`     ${index + 1}. ${job.fileName} - ${job.status} - 位置: ${job.queuePosition}`);
    });

    console.log('\n4. 查看用户历史记录...');
    const historyRes = await axios.get(`${BASE_URL}/print/jobs?studentId=2024002&limit=10`);
    console.log(`   ✓ 总记录数: ${historyRes.data.total}`);
    historyRes.data.jobs.forEach(job => {
      let statusText = `状态: ${job.status}`;
      if (job.refundStatus === 'processed' && job.refundAmount > 0) {
        statusText += ` | 退款: ¥${job.refundAmount}`;
      }
      console.log(`     - ${job.fileName} | ${statusText} | ¥${job.amount}`);
    });

    console.log('\n=== 异常场景测试完成 ===');
    console.log('\n计费说明:');
    console.log('  - 黑白单面: ¥0.10/页');
    console.log('  - 黑白双面: ¥0.15/页');
    console.log('  - 彩色单面: ¥1.00/页');
    console.log('  - 彩色双面: ¥1.50/页');
    console.log('\n退款规则:');
    console.log('  - 未开始打印: 全额退款');
    console.log('  - 打印中断: 按未打印页数比例退款');
    console.log('  - 打印完成: 不退款');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('错误详情:', error.response.data);
    }
  }
}

testExceptionScenarios();
