/**
 * 管理员面板交互体验优化测试
 * 用于验证按钮状态管理和用户反馈机制
 */

// 模拟小程序API
const mockWx = {
  showLoading: (options) => console.log('显示加载:', options.title),
  hideLoading: () => console.log('隐藏加载'),
  showToast: (options) => console.log('显示提示:', options.title, options.icon),
  showModal: (options) => console.log('显示对话框:', options.title, options.content)
};

// 模拟页面对象
const mockPage = {
  data: {
    buttonStates: {}
  },
  setData: function(data) {
    Object.assign(this.data, data);
    console.log('页面数据更新:', data);
  }
};

// 引入按钮状态管理器
const { createButtonStateManager } = require('../miniprogram/utils/buttonStateManager');

/**
 * 测试基本按钮状态管理
 */
function testBasicButtonManagement() {
  console.log('\n=== 测试基本按钮状态管理 ===');
  
  const buttonManager = createButtonStateManager(mockPage);
  
  // 初始化按钮
  buttonManager.initButton('testBtn', {
    text: '测试按钮',
    type: 'primary'
  });
  
  console.log('初始状态:', mockPage.data.buttonStates.testBtn);
  
  // 设置加载状态
  buttonManager.setLoading('testBtn', '处理中...');
  console.log('加载状态:', mockPage.data.buttonStates.testBtn);
  
  // 设置成功状态
  setTimeout(() => {
    buttonManager.setSuccess('testBtn', '操作成功');
    console.log('成功状态:', mockPage.data.buttonStates.testBtn);
  }, 1000);
}

/**
 * 测试异步操作执行
 */
async function testAsyncExecution() {
  console.log('\n=== 测试异步操作执行 ===');
  
  const buttonManager = createButtonStateManager(mockPage);
  
  buttonManager.initButton('asyncBtn', {
    text: '异步操作',
    type: 'primary'
  });
  
  // 模拟成功的异步操作
  try {
    await buttonManager.executeAsync('asyncBtn', async () => {
      console.log('执行异步操作...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { success: true, data: '操作结果' };
    }, {
      loadingText: '执行中...',
      successText: '操作完成'
    });
    
    console.log('异步操作成功完成');
  } catch (error) {
    console.error('异步操作失败:', error);
  }
}

/**
 * 测试错误处理
 */
async function testErrorHandling() {
  console.log('\n=== 测试错误处理 ===');
  
  const buttonManager = createButtonStateManager(mockPage);
  
  buttonManager.initButton('errorBtn', {
    text: '错误测试',
    type: 'primary'
  });
  
  // 模拟失败的异步操作
  try {
    await buttonManager.executeAsync('errorBtn', async () => {
      console.log('执行会失败的操作...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      throw new Error('模拟的操作失败');
    }, {
      loadingText: '执行中...',
      successText: '操作完成',
      useErrorModal: true,
      errorTitle: '操作失败'
    });
  } catch (error) {
    console.log('捕获到预期错误:', error.message);
  }
}

/**
 * 测试防重复点击
 */
function testClickPrevention() {
  console.log('\n=== 测试防重复点击 ===');
  
  const buttonManager = createButtonStateManager(mockPage);
  
  buttonManager.initButton('clickBtn', {
    text: '防重复点击',
    type: 'primary'
  });
  
  // 连续点击测试
  console.log('第一次点击:', buttonManager.canClick('clickBtn'));
  console.log('立即第二次点击:', buttonManager.canClick('clickBtn'));
  
  // 等待后再点击
  setTimeout(() => {
    console.log('1秒后点击:', buttonManager.canClick('clickBtn'));
  }, 1100);
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('开始测试管理员面板交互体验优化...');
  
  // 替换全局wx对象进行测试
  global.wx = mockWx;
  
  testBasicButtonManagement();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await testAsyncExecution();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  await testErrorHandling();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  testClickPrevention();
  
  console.log('\n所有测试完成！');
}

// 如果是直接运行此文件
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testBasicButtonManagement,
  testAsyncExecution,
  testErrorHandling,
  testClickPrevention,
  runAllTests
};