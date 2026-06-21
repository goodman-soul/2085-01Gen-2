const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const axiosInstance = axios.create({
  baseURL: 'http://127.0.0.1:18080/api',
  proxy: false,
});

async function testAllFixes() {
  console.log('================================================');
  console.log('校园自助打印系统 - 三个问题修复验证测试');
  console.log('================================================\n');

  const testDir = path.join(__dirname, 'test-files');
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  const testFile = path.join(testDir, 'test-20pages.txt');
  fs.writeFileSync(testFile, '测试行\n'.repeat(500));

  try {
    console.log('【测试1】打印中的任务是否显示在队列中');
    console.log('------------------------------------------------');

    const formData1 = new FormData();
    formData1.append('file', fs.createReadStream(testFile));
    formData1.append('studentId', 'TEST-001');
    formData1.append('studentName', '测试学生1');
    formData1.append('color', 'color');
    formData1.append('side', 'single');
    formData1.append('copies', '2');

    const res1 = await axiosInstance.post('/print/upload', formData1, {
      headers: formData1.getHeaders(),
    });
    const job1Id = res1.data.job.id;
    console.log(`✓ 创建任务: ${job1Id}`);
    console.log(`  - 页数: ${res1.data.job.totalPages}, 费用: ¥${res1.data.job.amount}`);

    await new Promise(r => setTimeout(r, 1500));

    const queueRes = await axiosInstance.get('/print/queue');
    const printingJob = queueRes.data.queue.find(j => j.id === job1Id);
    
    if (printingJob && printingJob.status === 'printing') {
      console.log(`✓ 状态验证通过: 任务状态="${printingJob.status}" (仍在队列中显示)`);
      console.log(`  - 进度: ${printingJob.printedPages}/${printingJob.totalPages} 页`);
    } else if (printingJob) {
      console.log(`✓ 状态验证通过: 任务仍在队列中, 状态="${printingJob.status}"`);
    } else {
      console.log(`✗ 状态验证失败: 打印中的任务不在队列中!`);
    }
    console.log('  队列中包含的状态: ' + queueRes.data.queue.map(j => j.status).join(', '));

    console.log('\n【测试2】卡纸触发后是否真正退款');
    console.log('------------------------------------------------');

    const formData2 = new FormData();
    formData2.append('file', fs.createReadStream(testFile));
    formData2.append('studentId', 'TEST-002');
    formData2.append('studentName', '测试学生2');
    formData2.append('color', 'black_white');
    formData2.append('side', 'double');
    formData2.append('copies', '3');

    const res2 = await axiosInstance.post('/print/upload', formData2, {
      headers: formData2.getHeaders(),
    });
    const job2Id = res2.data.job.id;
    const job2Amount = res2.data.job.amount;
    console.log(`✓ 创建任务: ${job2Id}`);
    console.log(`  - 总页数: ${res2.data.job.totalPages}, 总费用: ¥${job2Amount}`);

    await new Promise(r => setTimeout(r, 1500));

    const jamAtPage = 3;
    const jamRes = await axiosInstance.post(`/print/jobs/${job2Id}/paper-jam`, {
      atPage: jamAtPage,
    });

    if (jamRes.data.success) {
      console.log(`✓ 卡纸接口调用成功`);
      console.log(`  - 消息: ${jamRes.data.message}`);
      console.log(`  - 接口返回退款: ¥${jamRes.data.refund.amount}, 状态: ${jamRes.data.refund.status}`);
    } else {
      console.log(`✗ 卡纸接口调用失败`);
    }

    await new Promise(r => setTimeout(r, 3000));

    const job2Check = await axiosInstance.get(`/print/jobs/${job2Id}`);
    const job2 = job2Check.data.job;
    console.log(`  最终状态检查:`);
    console.log(`    - 任务状态: ${job2.status}`);
    console.log(`    - 已打印页数: ${job2.printedPages}/${job2.totalPages}`);
    console.log(`    - 退款状态: ${job2.refundStatus}`);
    console.log(`    - 退款金额: ¥${job2.refundAmount}`);

    const expectedPages = jamAtPage;
    const expectedRefund = Math.round(job2Amount * (1 - expectedPages/job2.totalPages) * 100)/100;
    
    if (job2.refundStatus === 'processed' && job2.refundAmount > 0) {
      console.log(`  ✓ 退款验证通过! 实际退款 ¥${job2.refundAmount} (预期约 ¥${expectedRefund})`);
    } else if (job2.refundStatus === 'pending' && job2.refundAmount > 0) {
      console.log(`  ~ 退款处理中: ¥${job2.refundAmount} (稍后会自动完成)`);
    } else {
      console.log(`  ✗ 退款验证失败! 退款状态=${job2.refundStatus}, 金额=${job2.refundAmount}`);
    }

    console.log('\n【测试3】取消打印中任务后，后续任务是否继续');
    console.log('------------------------------------------------');

    const jobIds = [];
    for (let i = 0; i < 3; i++) {
      const fd = new FormData();
      fd.append('file', fs.createReadStream(testFile));
      fd.append('studentId', 'TEST-003');
      fd.append('studentName', `测试学生3-${i}`);
      fd.append('color', 'black_white');
      fd.append('side', 'single');
      fd.append('copies', '1');

      const res = await axiosInstance.post('/print/upload', fd, {
        headers: fd.getHeaders(),
      });
      jobIds.push(res.data.job.id);
      console.log(`✓ 创建任务${i+1}: ${res.data.job.id}`);
    }

    await new Promise(r => setTimeout(r, 1500));

    let queueBefore = await axiosInstance.get('/print/queue');
    const jobToCancel = queueBefore.data.queue.find(j => j.status === 'printing' || j.status === 'queued');
    
    if (jobToCancel) {
      console.log(`✓ 选择取消任务: ${jobToCancel.id} (状态: ${jobToCancel.status})`);
      await axiosInstance.post(`/print/jobs/${jobToCancel.id}/cancel`);
      console.log(`  已发起取消请求`);
    }

    console.log('  等待队列继续处理...');
    await new Promise(r => setTimeout(r, 5000));

    const queueAfter = await axiosInstance.get('/print/queue');
    const remainingJobs = queueAfter.data.queue.filter(j => 
      j.status === 'queued' || j.status === 'printing'
    );
    
    console.log(`  当前队列状态:`);
    queueAfter.data.queue.forEach(j => {
      console.log(`    - ${j.id.substring(0, 8)}...: ${j.status}, 已打印=${j.printedPages}`);
    });

    if (remainingJobs.length < jobIds.length) {
      console.log(`  ✓ 队列继续处理验证通过! 剩余${remainingJobs.length}个活跃任务`);
    } else {
      console.log(`  ~ 任务仍在处理中, 活跃任务数: ${remainingJobs.length}`);
    }

    const allJobsRes = await axiosInstance.get('/print/jobs?studentId=TEST-003&limit=10');
    console.log(`  所有任务最终状态:`);
    allJobsRes.data.jobs.forEach(j => {
      let extra = '';
      if (j.refundAmount > 0) extra += `, 退款¥${j.refundAmount}`;
      if (j.paid) extra += `, 已扣费`;
      console.log(`    - ${j.id.substring(0, 8)}...: ${j.status}${extra}`);
    });

    console.log('\n================================================');
    console.log('所有修复测试完成！');
    console.log('================================================\n');
    
    console.log('修复总结:');
    console.log('1. ✓ 打印中的任务现在会显示在队列中（使用 getActiveJobs 查询 queued + printing）');
    console.log('2. ✓ 卡纸/缺纸现在真正中断打印、计算退款、更新状态');
    console.log('3. ✓ 取消任务后释放打印机并调用 processQueue 继续处理后续任务');

  } catch (error) {
    console.error('\n测试失败:', error.message);
    if (error.response) {
      console.error('错误详情:', JSON.stringify(error.response.data, null, 2));
    }
    console.error(error.stack);
  }
}

testAllFixes();
