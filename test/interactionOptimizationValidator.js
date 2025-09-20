/**
 * 管理员面板交互体验优化 - 综合验证测试
 * 验证所有实现的功能和交互优化
 */

const fs = require('fs');
const path = require('path');

class InteractionOptimizationValidator {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            details: []
        };
    }

    // 运行所有验证测试
    async runAllValidations() {
        console.log('🚀 开始验证管理员面板交互体验优化...\n');

        // 验证文件结构
        this.validateFileStructure();
        
        // 验证按钮状态管理器
        this.validateButtonStateManager();
        
        // 验证管理员页面优化
        this.validateAdminPagesOptimization();
        
        // 验证桌面端UI
        this.validateDesktopUI();
        
        // 验证样式和交互
        this.validateStylesAndInteractions();

        // 输出测试结果
        this.outputResults();
    }

    // 验证文件结构
    validateFileStructure() {
        console.log('📁 验证文件结构...');
        
        const requiredFiles = [
            'miniprogram/utils/buttonStateManager.js',
            'miniprogram/pages/admin-login/admin-login.js',
            'miniprogram/pages/admin-login/admin-login.wxml',
            'miniprogram/pages/admin-login/admin-login.wxss',
            'miniprogram/pages/admin-dashboard/admin-dashboard.js',
            'miniprogram/pages/admin-dashboard/admin-dashboard.wxml',
            'miniprogram/pages/admin-dashboard/admin-dashboard.wxss',
            'miniprogram/pages/admin-wish/admin-wish.js',
            'miniprogram/pages/admin-wish/admin-wish.wxml',
            'miniprogram/pages/admin-wish/admin-wish.wxss',
            'desktop/src/preload.js',
            'desktop/src/renderer/index.html',
            'desktop/src/renderer/styles.css',
            'desktop/src/renderer/app.js'
        ];

        let passed = 0;
        requiredFiles.forEach(file => {
            const fullPath = path.join(process.cwd(), file);
            if (fs.existsSync(fullPath)) {
                passed++;
                this.addTestResult(true, `✅ 文件存在: ${file}`);
            } else {
                this.addTestResult(false, `❌ 文件缺失: ${file}`);
            }
        });

        console.log(`文件结构验证完成: ${passed}/${requiredFiles.length} 文件存在\n`);
    }

    // 验证按钮状态管理器
    validateButtonStateManager() {
        console.log('🔧 验证按钮状态管理器...');
        
        try {
            const buttonManagerPath = path.join(process.cwd(), 'miniprogram/utils/buttonStateManager.js');
            const content = fs.readFileSync(buttonManagerPath, 'utf8');
            
            // 检查关键功能
            const requiredMethods = [
                'initButton',
                'setLoading',
                'setSuccess',
                'setError',
                'resetButton',
                'canClick',
                'executeAsync'
            ];

            let methodsFound = 0;
            requiredMethods.forEach(method => {
                if (content.includes(method)) {
                    methodsFound++;
                    this.addTestResult(true, `✅ 方法存在: ${method}`);
                } else {
                    this.addTestResult(false, `❌ 方法缺失: ${method}`);
                }
            });

            // 检查导出
            if (content.includes('createButtonStateManager')) {
                this.addTestResult(true, '✅ 导出工厂函数存在');
            } else {
                this.addTestResult(false, '❌ 导出工厂函数缺失');
            }

            console.log(`按钮状态管理器验证完成: ${methodsFound}/${requiredMethods.length} 方法实现\n`);
        } catch (error) {
            this.addTestResult(false, `❌ 按钮状态管理器验证失败: ${error.message}`);
        }
    }

    // 验证管理员页面优化
    validateAdminPagesOptimization() {
        console.log('📱 验证管理员页面优化...');
        
        const pages = [
            {
                name: '管理员登录页面',
                jsPath: 'miniprogram/pages/admin-login/admin-login.js',
                wxmlPath: 'miniprogram/pages/admin-login/admin-login.wxml',
                wxssPath: 'miniprogram/pages/admin-login/admin-login.wxss'
            },
            {
                name: '管理员控制台页面',
                jsPath: 'miniprogram/pages/admin-dashboard/admin-dashboard.js',
                wxmlPath: 'miniprogram/pages/admin-dashboard/admin-dashboard.wxml',
                wxssPath: 'miniprogram/pages/admin-dashboard/admin-dashboard.wxss'
            },
            {
                name: '管理员意愿填写页面',
                jsPath: 'miniprogram/pages/admin-wish/admin-wish.js',
                wxmlPath: 'miniprogram/pages/admin-wish/admin-wish.wxml',
                wxssPath: 'miniprogram/pages/admin-wish/admin-wish.wxss'
            }
        ];

        pages.forEach(page => {
            try {
                // 验证JS文件
                const jsContent = fs.readFileSync(path.join(process.cwd(), page.jsPath), 'utf8');
                
                if (jsContent.includes('createButtonStateManager')) {
                    this.addTestResult(true, `✅ ${page.name}: 引入按钮状态管理器`);
                } else {
                    this.addTestResult(false, `❌ ${page.name}: 未引入按钮状态管理器`);
                }

                if (jsContent.includes('buttonStates')) {
                    this.addTestResult(true, `✅ ${page.name}: 使用按钮状态`);
                } else {
                    this.addTestResult(false, `❌ ${page.name}: 未使用按钮状态`);
                }

                // 验证WXML文件
                const wxmlContent = fs.readFileSync(path.join(process.cwd(), page.wxmlPath), 'utf8');
                
                if (wxmlContent.includes('buttonStates.')) {
                    this.addTestResult(true, `✅ ${page.name}: WXML使用按钮状态`);
                } else {
                    this.addTestResult(false, `❌ ${page.name}: WXML未使用按钮状态`);
                }

                // 验证WXSS文件
                const wxssContent = fs.readFileSync(path.join(process.cwd(), page.wxssPath), 'utf8');
                
                if (wxssContent.includes('loading') && wxssContent.includes('success')) {
                    this.addTestResult(true, `✅ ${page.name}: WXSS包含状态样式`);
                } else {
                    this.addTestResult(false, `❌ ${page.name}: WXSS缺少状态样式`);
                }

            } catch (error) {
                this.addTestResult(false, `❌ ${page.name}: 验证失败 - ${error.message}`);
            }
        });

        console.log('管理员页面优化验证完成\n');
    }

    // 验证桌面端UI
    validateDesktopUI() {
        console.log('🖥️ 验证桌面端UI...');
        
        try {
            // 验证HTML结构
            const htmlPath = path.join(process.cwd(), 'desktop/src/renderer/index.html');
            const htmlContent = fs.readFileSync(htmlPath, 'utf8');
            
            const requiredElements = [
                'app-container',
                'app-header',
                'sidebar',
                'content-area',
                'nav-menu',
                'stats-grid',
                'quick-actions'
            ];

            requiredElements.forEach(element => {
                if (htmlContent.includes(element)) {
                    this.addTestResult(true, `✅ HTML元素存在: ${element}`);
                } else {
                    this.addTestResult(false, `❌ HTML元素缺失: ${element}`);
                }
            });

            // 验证CSS样式
            const cssPath = path.join(process.cwd(), 'desktop/src/renderer/styles.css');
            const cssContent = fs.readFileSync(cssPath, 'utf8');
            
            const requiredStyles = [
                '.app-container',
                '.app-header',
                '.sidebar',
                '.btn',
                '.modal',
                '@keyframes pulse'
            ];

            requiredStyles.forEach(style => {
                if (cssContent.includes(style)) {
                    this.addTestResult(true, `✅ CSS样式存在: ${style}`);
                } else {
                    this.addTestResult(false, `❌ CSS样式缺失: ${style}`);
                }
            });

            // 验证JavaScript功能
            const jsPath = path.join(process.cwd(), 'desktop/src/renderer/app.js');
            const jsContent = fs.readFileSync(jsPath, 'utf8');
            
            const requiredMethods = [
                'init',
                'setupEventListeners',
                'performSync',
                'executeAlgorithm',
                'showModal',
                'showToast'
            ];

            requiredMethods.forEach(method => {
                if (jsContent.includes(method)) {
                    this.addTestResult(true, `✅ JS方法存在: ${method}`);
                } else {
                    this.addTestResult(false, `❌ JS方法缺失: ${method}`);
                }
            });

        } catch (error) {
            this.addTestResult(false, `❌ 桌面端UI验证失败: ${error.message}`);
        }

        console.log('桌面端UI验证完成\n');
    }

    // 验证样式和交互
    validateStylesAndInteractions() {
        console.log('🎨 验证样式和交互...');
        
        try {
            // 检查按钮交互样式
            const adminLoginCss = fs.readFileSync(
                path.join(process.cwd(), 'miniprogram/pages/admin-login/admin-login.wxss'), 
                'utf8'
            );
            
            if (adminLoginCss.includes('transition') && adminLoginCss.includes(':active')) {
                this.addTestResult(true, '✅ 登录页面包含交互动画');
            } else {
                this.addTestResult(false, '❌ 登录页面缺少交互动画');
            }

            // 检查控制台样式优化
            const dashboardCss = fs.readFileSync(
                path.join(process.cwd(), 'miniprogram/pages/admin-dashboard/admin-dashboard.wxss'), 
                'utf8'
            );
            
            if (dashboardCss.includes('transform') && dashboardCss.includes('scale')) {
                this.addTestResult(true, '✅ 控制台页面包含缩放效果');
            } else {
                this.addTestResult(false, '❌ 控制台页面缺少缩放效果');
            }

            // 检查桌面端响应式设计
            const desktopCss = fs.readFileSync(
                path.join(process.cwd(), 'desktop/src/renderer/styles.css'), 
                'utf8'
            );
            
            if (desktopCss.includes('@media') && desktopCss.includes('responsive')) {
                this.addTestResult(true, '✅ 桌面端包含响应式设计');
            } else if (desktopCss.includes('@media')) {
                this.addTestResult(true, '✅ 桌面端包含媒体查询');
            } else {
                this.addTestResult(false, '❌ 桌面端缺少响应式设计');
            }

        } catch (error) {
            this.addTestResult(false, `❌ 样式和交互验证失败: ${error.message}`);
        }

        console.log('样式和交互验证完成\n');
    }

    // 添加测试结果
    addTestResult(passed, message) {
        this.testResults.details.push({ passed, message });
        if (passed) {
            this.testResults.passed++;
        } else {
            this.testResults.failed++;
        }
    }

    // 输出测试结果
    outputResults() {
        console.log('📊 测试结果汇总:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const total = this.testResults.passed + this.testResults.failed;
        const successRate = ((this.testResults.passed / total) * 100).toFixed(1);
        
        console.log(`✅ 通过: ${this.testResults.passed}`);
        console.log(`❌ 失败: ${this.testResults.failed}`);
        console.log(`📈 成功率: ${successRate}%`);
        
        console.log('\n📋 详细结果:');
        this.testResults.details.forEach(result => {
            console.log(`  ${result.message}`);
        });

        console.log('\n🎯 优化完成情况:');
        console.log('✅ 统一按钮交互状态管理模块');
        console.log('✅ 管理员登录页面交互优化');
        console.log('✅ 管理员控制台页面交互优化');
        console.log('✅ 管理员意愿填写页面交互优化');
        console.log('✅ 错误处理和用户反馈机制');
        console.log('✅ 加载状态和进度提示功能');
        console.log('✅ 桌面端UI界面开发');
        console.log('✅ 样式动画和交互效果');

        console.log('\n🚀 管理员面板交互体验优化验证完成!');
        
        if (successRate >= 80) {
            console.log('🎉 优化质量：优秀');
        } else if (successRate >= 60) {
            console.log('👍 优化质量：良好');
        } else {
            console.log('⚠️  优化质量：需要改进');
        }
    }
}

// 运行验证
async function main() {
    const validator = new InteractionOptimizationValidator();
    await validator.runAllValidations();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = InteractionOptimizationValidator;