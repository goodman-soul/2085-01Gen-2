const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4000/api';

async function testPrintSystem() {
  console.log('=== 校园自助打印系统测试 ===\n');

  try {
    console.log('1. 测试健康检查...');
    const healthRes = await axios.get(`${BASE_URL}/health`);
    console.log('   ✓ 服务正常:', healthRes.data.status);
  } catch (e) {
    console.error('   ✗ 健康检查失败:', e.message);
    console.log('   请先启动服务器: npm run dev:server');
    return;
  }

  try {
    console.log('\n2. 测试价格查询...');
    const pricingRes = await axios.get(`${BASE_URL}/print/pricing`);
    console.log('   ✓ 价格配置:', JSON.stringify(pricingRes.data.pricing));
  } catch (e) {
    console.error('   ✗ 价格查询失败:', e.message);
  }

  try {
    console.log('\n3. 测试费用计算...');
    const calcRes = await axios.post(`${BASE_URL}/print/calculate`, {
      pageCount: 10,
      color: 'black_white',
      side: 'double',
      copies: 2,
    });
    console.log('   ✓ 10页黑白双面2份 = ¥' + calcRes.data.price);
    console.log('   ✓ 总打印页数:', calcRes.data.totalPages);
  } catch (e) {
    console.error('   ✗ 费用计算失败:', e.message);
  }

  try {
    console.log('\n4. 测试创建测试文件...');
    const testDir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    
    const testFile = path.join(testDir, 'test-document.txt');
    const content = '测试文档内容\n'.repeat(50);
    fs.writeFileSync(testFile, content);
    console.log('   ✓ 测试文件已创建:', testFile);
  } catch (e) {
    console.error('   ✗ 创建测试文件失败:', e.message);
  }

  try {
    console.log('\n5. 测试上传文件并创建打印任务...');
    const testFile = path.join(__dirname, 'test-files', 'test-document.txt');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFile));
    formData.append('studentId', '2024001');
    formData.append('studentName', '张三');
    formData.append('color', 'black_white');
    formData.append('side', 'single');
    formData.append('copies', '2');

    const uploadRes = await axios.post(`${BASE_URL}/print/upload`, formData, {
      headers: formData.getHeaders(),
    });
    
    console.log('   ✓ 任务创建成功');
    console.log('     - 任务ID:', uploadRes.data.job.id);
    console.log('     - 文件名:', uploadRes.data.job.fileName);
    console.log('     - 状态:', uploadRes.data.job.status);
    console.log('     - 费用: ¥' + uploadRes.data.job.amount);
    console.log('     - 总页数:', uploadRes.data.job.totalPages);
    
    const jobId = uploadRes.data.job.id;

    await new Promise(r => setTimeout(r, 2000));

    console.log('\n6. 测试查询任务状态...');
    const jobRes = await axios.get(`${BASE_URL}/print/jobs/${jobId}`);
    console.log('   ✓ 当前状态:', jobRes.data.job.status);
    console.log('   ✓ 已打印页数:', jobRes.data.job.printedPages);

    console.log('\n7. 测试查询打印队列...');
    const queueRes = await axios.get(`${BASE_URL}/print/queue`);
    console.log('   ✓ 队列长度:', queueRes.data.count);

    console.log('\n8. 测试查询用户历史...');
    const historyRes = await axios.get(`${BASE_URL}/print/jobs?studentId=2024001&limit=5`);
    console.log('   ✓ 历史记录数:', historyRes.data.total);

    console.log('\n=== 基础功能测试完成 ===');
    console.log('\n下一步测试建议:');
    console.log('  - 等待打印完成，观察状态变化');
    console.log('  - 测试取消任务功能');
    console.log('  - 测试卡纸/缺纸异常场景');
    console.log('  - 访问前端界面: http://localhost:5173');
    
  } catch (e) {
    console.error('   ✗ 上传文件失败:', e.message);
    if (e.response) {
      console.error('     错误详情:', e.response.data);
    }
  }
}

testPrintSystem();
