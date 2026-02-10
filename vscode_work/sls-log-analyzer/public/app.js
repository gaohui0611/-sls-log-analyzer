/**
 * 前端应用逻辑
 */

// API 基础路径
const API_BASE = '/api';

// 全局状态
let state = {
    projects: {},
    config: {},
    authStatus: null
};

// 工具函数
function showLoading(elementId) {
    document.getElementById(elementId).classList.add('active');
}

function hideLoading(elementId) {
    document.getElementById(elementId).classList.remove('active');
}

function showAlert(elementId, message, type = 'info') {
    const container = document.getElementById(elementId);

    // 移除已存在的 alert
    const existingAlert = container.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // 创建新的 alert
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = message;

    // 插入到容器开头
    container.insertBefore(alertDiv, container.firstChild);

    // 5秒后自动移除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// API 调用
async function apiRequest(url, options = {}) {
    const { timeout, ...restOptions } = options;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(restOptions.headers || {})
        }
    };

    // 合并选项，确保 headers 正确处理
    const mergedOptions = {
        ...restOptions,
        headers: defaultOptions.headers
    };

    // 如果有 body 且是对象，转换为 JSON 字符串
    if (mergedOptions.body && typeof mergedOptions.body === 'object') {
        mergedOptions.body = JSON.stringify(mergedOptions.body);
    }

    // 处理超时
    let controller;
    if (timeout) {
        controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        mergedOptions.signal = controller.signal;
    }

    try {
        const response = await fetch(`${API_BASE}${url}`, mergedOptions);
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || '请求失败');
        }
        return data;
    } finally {
        if (controller) {
            clearTimeout(controller.timeoutId);
        }
    }
}

// 标签页切换事件监听器已移至 DOMContentLoaded 中

// ========== 项目管理 ==========

async function loadProjects() {
    try {
        const response = await apiRequest('/config');
        state.projects = response.data.projects || {};
        renderProjects();
        updateProjectSelect();
    } catch (error) {
        console.error('加载项目失败:', error);
    }
}

function renderProjects() {
    const container = document.getElementById('projectList');

    if (Object.keys(state.projects).length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📁</div>
        <p>还没有配置任何项目</p>
      </div>
    `;
        return;
    }

    container.innerHTML = Object.entries(state.projects).map(([id, project]) => `
    <div class="project-item" data-id="${id}">
      <div class="info">
        <h4>${project.name}</h4>
        <p>SLS: ${project.projectName} / ${project.logStoreName}</p>
      </div>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" onclick="openEditProjectModal('${id}')">
          ✏️ 编辑
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteProject('${id}')">
          🗑️ 删除
        </button>
      </div>
    </div>
  `).join('');
}

function updateProjectSelect() {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">-- 请选择项目 --</option>';

    Object.entries(state.projects).forEach(([id, project]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = project.name;
        select.appendChild(option);
    });
}


async function deleteProject(id) {
    if (!confirm('确定要删除这个项目吗?')) return;

    delete state.projects[id];

    try {
        await apiRequest('/config', {
            method: 'POST',
            body: { projects: state.projects }
        });
        loadProjects();
        showAlert('projects-tab', '✅ 项目已删除', 'success');
    } catch (error) {
        showAlert('projects-tab', `❌ 删除失败: ${error.message}`, 'error');
    }
}

// 打开编辑项目模态框
function openEditProjectModal(id) {
    const project = state.projects[id];
    if (!project) {
        showAlert('projects-tab', '❌ 项目不存在', 'error');
        return;
    }

    document.getElementById('editProjectId').value = id;
    document.getElementById('editProjectName').value = project.name;
    document.getElementById('editSlsProject').value = project.projectName;
    document.getElementById('editLogStore').value = project.logStoreName;

    const modal = document.getElementById('editProjectModal');
    modal.style.display = 'flex';
}

// 关闭编辑项目模态框
function closeEditProjectModal() {
    const modal = document.getElementById('editProjectModal');
    modal.style.display = 'none';
}

// 保存编辑的项目
async function saveEditProject() {
    const id = document.getElementById('editProjectId').value;
    const name = document.getElementById('editProjectName').value.trim();
    const projectName = document.getElementById('editSlsProject').value.trim();
    const logStoreName = document.getElementById('editLogStore').value.trim();

    if (!name || !projectName || !logStoreName) {
        showAlert('projects-tab', '请填写所有字段', 'error');
        return;
    }

    state.projects[id] = { name, projectName, logStoreName };

    try {
        await apiRequest('/config', {
            method: 'POST',
            body: { projects: state.projects }
        });

        closeEditProjectModal();
        loadProjects();
        showAlert('projects-tab', '✅ 项目已更新', 'success');
    } catch (error) {
        showAlert('projects-tab', `❌ 更新失败: ${error.message}`, 'error');
    }
}

// ========== AI 配置编辑 ==========

// 打开编辑AI配置模态框
function openEditAiModal() {
    const config = state.config;

    document.getElementById('editAiProvider').value = config.aiProvider || 'anthropic';
    document.getElementById('editAiApiKey').value = ''; // 不显示已保存的 API Key
    document.getElementById('editAiModel').value = config.aiModel || '';
    document.getElementById('editAiBaseUrl').value = config.aiBaseUrl || '';

    // 根据提供商设置 Base URL 输入框的显示状态
    const baseUrlGroup = document.getElementById('editBaseUrlGroup');
    if (config.aiProvider === 'openai-compatible') {
        baseUrlGroup.style.display = 'block';
    } else {
        baseUrlGroup.style.display = 'none';
    }

    const modal = document.getElementById('editAiModal');
    modal.style.display = 'flex';
}

// 关闭编辑AI配置模态框
function closeEditAiModal() {
    const modal = document.getElementById('editAiModal');
    modal.style.display = 'none';
}

// 保存编辑的AI配置
async function saveEditAiConfig() {
    const provider = document.getElementById('editAiProvider').value;
    const apiKey = document.getElementById('editAiApiKey').value.trim();
    const model = document.getElementById('editAiModel').value.trim();
    const baseUrl = document.getElementById('editAiBaseUrl').value.trim();

    if (!model) {
        showAlert('ai-tab', '请填写模型名称', 'error');
        return;
    }

    if (provider === 'openai-compatible' && !baseUrl) {
        showAlert('ai-tab', 'OpenAI 兼容 API 需要填写 Base URL', 'error');
        return;
    }

    const aiConfig = {
        provider,
        model
    };

    if (apiKey) {
        aiConfig.apiKey = apiKey;
    }

    if (baseUrl) {
        aiConfig.baseUrl = baseUrl;
    }

    try {
        await apiRequest('/config', {
            method: 'POST',
            body: { aiConfig }
        });

        // 更新本地状态
        state.config.aiProvider = aiConfig.provider;
        state.config.aiModel = aiConfig.model;
        if (aiConfig.baseUrl) {
            state.config.aiBaseUrl = aiConfig.baseUrl;
        }
        if (aiConfig.apiKey) {
            state.config.hasApiKey = true;
        }

        closeEditAiModal();
        updateAiConfigDisplay();
        showAlert('ai-tab', '✅ AI 配置已更新', 'success');
    } catch (error) {
        showAlert('ai-tab', `❌ 更新失败: ${error.message}`, 'error');
    }
}

// 删除AI配置
async function deleteAiConfig() {
    if (!confirm('确定要删除 AI 配置吗?')) return;

    try {
        await apiRequest('/config', {
            method: 'POST',
            body: { aiConfig: null }
        });

        // 清除本地状态
        state.config.aiProvider = null;
        state.config.aiModel = null;
        state.config.aiBaseUrl = null;
        state.config.hasApiKey = false;

        updateAiConfigDisplay();
        showAlert('ai-tab', '✅ AI 配置已删除', 'success');
    } catch (error) {
        showAlert('ai-tab', `❌ 删除失败: ${error.message}`, 'error');
    }
}

// ========== 日志分析 ==========

function renderAnalysisResult(data) {
    const container = document.getElementById('analyzeResult');

    // 格式化创建时间
    const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN') : '未知';
    const reportId = data.id || '未知';

    let html = `
    <div class="card" style="margin-top: 30px;">
      <h3>📊 分析结果</h3>

      <!-- 输入参数 -->
      <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf3 100%); border-radius: 12px; padding: 25px; margin-bottom: 25px;">
        <h4 style="margin: 0 0 20px 0; color: #667eea; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
          <span>📋</span> 分析输入参数
        </h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 30px; font-size: 0.95rem;">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">报告 ID:</span>
            <code style="background: white; padding: 4px 10px; border-radius: 6px; font-size: 0.85rem; border: 1px solid #dee2e6;">${reportId.substring(0, 8)}...</code>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">创建时间:</span>
            <span style="color: #333;">${createdAt}</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">SLS 项目:</span>
            <span style="color: #333; font-weight: 500;">${data.projectName}</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">LogStore:</span>
            <span style="color: #333; font-weight: 500;">${data.logStoreName}</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">时间范围:</span>
            <span style="background: rgba(102,126,234,0.1); color: #667eea; padding: 4px 12px; border-radius: 6px; font-weight: 500;">${data.timeRange}</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">开始时间:</span>
            <span style="color: #333;">${data.timeFrom}</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">结束时间:</span>
            <span style="color: #333;">${data.timeTo}</span>
          </div>
          ${data.query ? `
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">查询关键词:</span>
            <code style="background: white; padding: 4px 12px; border-radius: 6px; border: 1px solid #dee2e6; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${data.query}</code>
          </div>
          ` : '<div></div>'}
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">请求数量:</span>
            <span style="color: #333; font-weight: 600;">${data.size || 100} 条</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">日志总数:</span>
            <span style="color: #333; font-weight: 600;">${data.logCount || 0} 条</span>
          </div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="color: #6c757d; font-weight: 500; min-width: 90px;">实际返回:</span>
            <span style="color: #28a745; font-weight: 600;">${data.returnedCount || 0} 条</span>
          </div>
        </div>
      </div>
    </div>
  `;

    // 统计信息
    if (data.stats) {
        html += `
      <div class="card">
        <h3>📈 日志统计</h3>
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
    `;

        if (data.stats.byLevel) {
            Object.entries(data.stats.byLevel).forEach(([level, count]) => {
                html += `<div class="stat">
          <span class="tag tag-${level.toLowerCase()}">${level}</span>
          <strong>${count}</strong>
        </div>`;
            });
        }

        html += `</div>`;

        // 错误列表
        if (data.stats.errors && data.stats.errors.length > 0) {
            html += `
        <h4 style="margin-top: 20px;">⚠️ 错误 (${data.stats.errors.length})</h4>
        <div style="max-height: 300px; overflow-y: auto;">
      `;
            data.stats.errors.slice(0, 10).forEach(error => {
                html += `
          <div class="log-entry error">
            <div class="time">${error.time}</div>
            <div class="message">${escapeHtml(error.message)}</div>
          </div>
        `;
            });
            html += '</div>';
        }

        html += '</div>';
    }

    // AI 分析
    if (data.aiAnalysis && data.aiAnalysis.content) {
        try {
            const markdownHtml = renderMarkdown(data.aiAnalysis.content);
            html += `
      <div class="card">
        <h3>🤖 AI 智能分析</h3>
        <div class="markdown-content">${markdownHtml}</div>
      </div>
    `;
        } catch (error) {
            console.error('渲染 AI 分析失败:', error);
            html += `
      <div class="card">
        <h3>🤖 AI 智能分析</h3>
        <div class="markdown-content" style="white-space: pre-wrap; word-break: break-all;">${data.aiAnalysis.content}</div>
      </div>
    `;
        }
    }

    container.innerHTML = html;
}

function renderMarkdown(text) {
    // 首先处理代码块，避免其内容被其他规则影响
    const codeBlocks = [];
    let codeIndex = 0;
    text = text.replace(/```([\s\S]*?)```/g, (match) => {
        const placeholder = `__CODE_BLOCK_${codeIndex}__`;
        codeBlocks[codeIndex] = `<pre><code>${escapeHtml(match.slice(3, -3))}</code></pre>`;
        codeIndex++;
        return placeholder;
    });

    // 处理内联代码
    const inlineCodes = [];
    let inlineIndex = 0;
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineIndex}__`;
        inlineCodes[inlineIndex] = `<code>${escapeHtml(code)}</code>`;
        inlineIndex++;
        return placeholder;
    });

    // 处理标题，从最具体的开始
    text = text
        .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
        .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
        // 处理粗体
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        // 处理换行
        .replace(/\n/g, '<br>');

    // 恢复代码块
    for (let i = 0; i < codeBlocks.length; i++) {
        text = text.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
    }

    // 恢复内联代码
    for (let i = 0; i < inlineCodes.length; i++) {
        text = text.replace(`__INLINE_CODE_${i}__`, inlineCodes[i]);
    }

    return text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== 报告列表 ==========

async function loadReports() {
    try {
        const response = await apiRequest('/reports');
        renderReports(response.data);
    } catch (error) {
        console.error('加载报告失败:', error);
    }
}

function renderReports(reports) {
    const container = document.getElementById('reportList');

    if (reports.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📊</div>
        <p>还没有分析报告</p>
      </div>
    `;
        return;
    }

    container.innerHTML = reports.map(report => `
    <div class="report-item">
      <div class="header">
        <div>
          <div class="title">${report.projectName} - ${report.query || '全部'}</div>
          <div class="meta">
            📅 ${report.timeRange} · ${new Date(report.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary btn-sm" onclick="viewReport('${report.id}')">
            👁️ 查看
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteReport('${report.id}')">
            🗑️ 删除
          </button>
        </div>
      </div>
      <div class="stats">
        <div class="stat">📦 日志: <strong>${report.logCount}</strong></div>
      </div>
    </div>
  `).join('');
}

async function viewReport(id) {
    try {
        const response = await apiRequest(`/reports/${id}`);
        renderAnalysisResult(response.data);

        // 切换到分析标签页
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="analyze"]').classList.add('active');
        document.getElementById('analyze-tab').classList.add('active');
    } catch (error) {
        alert('加载报告失败: ' + error.message);
    }
}

async function deleteReport(id) {
    if (!confirm('确定要删除这个报告吗?')) return;

    try {
        await apiRequest(`/reports/${id}`, { method: 'DELETE' });
        loadReports();
        showAlert('reports-tab', '✅ 报告已删除', 'success');
    } catch (error) {
        showAlert('reports-tab', `❌ 删除失败: ${error.message}`, 'error');
    }
}


// ========== AI 配置 ==========

// ========== 认证设置 ==========

async function loadAuthStatus() {
    try {
        const response = await apiRequest('/auth-status');
        const authStatusEl = document.getElementById('authStatus');
        const data = response.data;

        // 使用 isValid 字段判断认证是否真正有效
        if (data.isValid) {
            authStatusEl.className = 'auth-status valid';
            authStatusEl.innerHTML = '<span class="icon">✅</span><span>认证有效</span>';
        } else {
            authStatusEl.className = 'auth-status invalid';
            let message = '需要同步认证';
            if (data.isExpired) message = '认证已过期';
            else if (!data.hasCookies) message = '缺少认证信息';
            else if (!data.isValid) message = '认证已失效';
            authStatusEl.innerHTML = `<span class="icon">⚠️</span><span>${message}</span>`;
        }
    } catch (error) {
        console.error('加载认证状态失败:', error);
    }
}

function parseCurlCommand(curl) {
    const result = {
        cookies: {},
        csrfToken: null,
        b3: null,
        region: 'cn-beijing'
    };

    // 先清理多行 curl 命令
    const cleanedCurl = curl.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ');

    console.log('=== 解析 curl 命令 ===');
    console.log('清理后长度:', cleanedCurl.length);

    // 方法 1: 从 -b 参数解析 cookies
    // 支持包含引号的 cookie 值
    let cookieString = null;

    // 先尝试匹配单引号包裹的 -b 参数
    const singleQuoteMatch = cleanedCurl.match(/-b\s+'([^']+)'/i);
    if (singleQuoteMatch) {
        cookieString = singleQuoteMatch[1];
    }

    // 如果没找到，尝试双引号
    if (!cookieString) {
        const doubleQuoteMatch = cleanedCurl.match(/-b\s+"([^"]+)"/i);
        if (doubleQuoteMatch) {
            cookieString = doubleQuoteMatch[1];
        }
    }

    // 如果还是没找到，尝试无引号（到下一个参数或行尾）
    if (!cookieString) {
        const noQuoteMatch = cleanedCurl.match(/-b\s+([^\s-][^'-]*?(?=\s+-|$))/i);
        if (noQuoteMatch) {
            cookieString = noQuoteMatch[1];
        }
    }

    if (cookieString) {
        console.log('从 -b 参数找到 cookies，长度:', cookieString.length);

        const pairs = cookieString.split('; ');
        pairs.forEach(pair => {
            const eqIndex = pair.indexOf('=');
            if (eqIndex > 0) {
                const key = pair.substring(0, eqIndex).trim();
                let value = pair.substring(eqIndex + 1).trim();
                // 去除值两端的引号（如果有）
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                result.cookies[key] = value;
            }
        });
        console.log('解析到 cookies:', Object.keys(result.cookies).length);
    }

    // 方法 2: 从 -H 'cookie:' 参数解析（备用）
    if (Object.keys(result.cookies).length === 0) {
        const cookiePatterns = [
            /-H\s+['"]cookie:\s*([^'"]+)['"]/i,
            /cookie:\s*'([^']+)'/i,
            /cookie:\s*"([^"]+)"/i,
            /cookie:\s*([^\s'"]+?)(?:\s+['"]|$)/i
        ];

        for (const pattern of cookiePatterns) {
            const cookieMatch = cleanedCurl.match(pattern);
            if (cookieMatch) {
                const cookieString = cookieMatch[1];
                const pairs = cookieString.split(';').map(p => p.trim()).filter(p => p);
                pairs.forEach(pair => {
                    const eqIndex = pair.indexOf('=');
                    if (eqIndex > 0) {
                        const key = pair.substring(0, eqIndex).trim();
                        const value = pair.substring(eqIndex + 1).trim();
                        result.cookies[key] = value;
                    }
                });
                console.log('从 -H cookie 解析到 cookies:', Object.keys(result.cookies).length);
                break;
            }
        }
    }

    // 解析 x-csrf-token - 从 -H 参数
    const csrfMatch = cleanedCurl.match(/-H\s+['"]x-csrf-token:\s*([^'"]+)['"]/i);
    if (csrfMatch) {
        result.csrfToken = csrfMatch[1].trim();
        console.log('解析到 x-csrf-token:', result.csrfToken);
    }

    // 解析 b3 - 从 -H 参数
    const b3Match = cleanedCurl.match(/-H\s+['"]b3:\s*([^'"]+)['"]/i);
    if (b3Match) {
        result.b3 = b3Match[1].trim();
        console.log('解析到 b3:', result.b3);
    }

    // 解析 region
    const regionMatch = cleanedCurl.match(/slRegion=([^&\s'"]+)/);
    if (regionMatch) {
        result.region = regionMatch[1];
        console.log('解析到 region:', result.region);
    }

    console.log('=== 解析结果 ===');
    console.log('Cookies 数量:', Object.keys(result.cookies).length);
    console.log('CSRF Token:', result.csrfToken || '无');
    console.log('B3:', result.b3 || '无');
    console.log('Region:', result.region);

    return result;
}

// ========== AI 配置显示 ==========

function updateAiConfigDisplay() {
    const displayEl = document.getElementById('aiConfigDisplay');
    if (!displayEl) return;

    const config = state.config;
    const hasApiKey = config.hasApiKey || false;

    if (!hasApiKey) {
        displayEl.innerHTML = `
            <div class="auth-status invalid">
                <span class="icon">⚠️</span>
                <span>未配置 AI</span>
            </div>
        `;
        return;
    }

    // 提供商显示名称
    const providerNames = {
        'anthropic': 'Anthropic Claude',
        'openai': 'OpenAI GPT',
        'openai-compatible': 'OpenAI 兼容'
    };

    const providerName = providerNames[config.aiProvider] || config.aiProvider;
    const modelName = config.aiModel || '未设置';

    displayEl.innerHTML = `
        <div class="auth-status valid" style="justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <span class="icon">✅</span>
                <div>
                    <div><strong>${providerName}</strong></div>
                    <div style="font-size: 0.9rem; margin-top: 4px;">模型: ${modelName}</div>
                    ${config.aiBaseUrl ? `<div style="font-size: 0.85rem; color: #6c757d;">API: ${config.aiBaseUrl}</div>` : ''}
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn btn-secondary btn-sm" onclick="openEditAiModal()">
                    ✏️ 编辑
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteAiConfig()">
                    🗑️ 删除
                </button>
            </div>
        </div>
    `;
}

// ========== 初始化 ==========

async function init() {
    console.log('开始初始化...');
    try {
        console.log('请求配置信息...');
        const response = await apiRequest('/config');
        console.log('配置信息:', response);
        state.config = response.data;
        state.projects = response.data.projects || {};

        // 更新 UI
        console.log('更新项目选择器...');
        updateProjectSelect();

        // 加载 AI 配置
        console.log('加载 AI 配置...');
        const aiProviderSelect = document.getElementById('aiProvider');
        const aiApiKeyInput = document.getElementById('aiApiKey');
        const aiModelInput = document.getElementById('aiModel');
        const aiBaseUrlInput = document.getElementById('aiBaseUrl');

        console.log('AI 配置:', state.config);

        if (state.config.aiProvider) {
            aiProviderSelect.value = state.config.aiProvider;
            console.log('设置 AI 提供商:', state.config.aiProvider);
        }
        if (state.config.aiModel) {
            aiModelInput.value = state.config.aiModel;
            console.log('设置 AI 模型:', state.config.aiModel);
        }
        if (state.config.aiBaseUrl) {
            aiBaseUrlInput.value = state.config.aiBaseUrl;
            console.log('设置 AI Base URL:', state.config.aiBaseUrl);
        }

        // 根据 AI 提供商设置 Base URL 输入框的显示状态
        console.log('设置 Base URL 输入框显示状态...');
        const baseUrlGroup = document.getElementById('baseUrlGroup');
        if (aiProviderSelect.value === 'openai-compatible') {
            baseUrlGroup.style.display = 'block';
            console.log('显示 Base URL 输入框');
        } else {
            baseUrlGroup.style.display = 'none';
            console.log('隐藏 Base URL 输入框');
        }

        // 检查认证状态
        console.log('检查认证状态...');
        loadAuthStatus();

        // 更新 AI 配置显示
        updateAiConfigDisplay();

        console.log('初始化完成!');
    } catch (error) {
        console.error('初始化失败:', error);
        console.error('错误详情:', error.stack);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM 加载完成，开始初始化...');

    // 初始化配置和状态
    await init();

    // 绑定所有事件监听器
    console.log('绑定事件监听器...');

    // 标签页切换
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');

            // 加载对应标签页的数据
            if (tabName === 'projects') loadProjects();
            if (tabName === 'reports') loadReports();
            if (tabName === 'settings') loadAuthStatus();
        });
    });

    // 项目管理事件
    if (document.getElementById('addProjectBtn')) {
        document.getElementById('addProjectBtn').addEventListener('click', async () => {
            const name = document.getElementById('newProjectName').value.trim();
            const projectName = document.getElementById('newSlsProject').value.trim();
            const logStoreName = document.getElementById('newLogStore').value.trim();

            if (!name || !projectName || !logStoreName) {
                showAlert('projects-tab', '请填写所有字段', 'error');
                return;
            }

            const id = Date.now().toString();
            state.projects[id] = { name, projectName, logStoreName };

            try {
                await apiRequest('/config', {
                    method: 'POST',
                    body: { projects: state.projects }
                });

                document.getElementById('newProjectName').value = '';
                document.getElementById('newSlsProject').value = '';
                document.getElementById('newLogStore').value = '';

                loadProjects();
                showAlert('projects-tab', '✅ 项目添加成功', 'success');
            } catch (error) {
                showAlert('projects-tab', `❌ 添加失败: ${error.message}`, 'error');
            }
        });
    }

    // AI 配置事件
    if (document.getElementById('aiProvider')) {
        document.getElementById('aiProvider').addEventListener('change', (e) => {
            const baseUrlGroup = document.getElementById('baseUrlGroup');
            if (e.target.value === 'openai-compatible') {
                baseUrlGroup.style.display = 'block';
            } else {
                baseUrlGroup.style.display = 'none';
            }
        });
    }

    // 编辑模态框中的 AI 配置事件
    if (document.getElementById('editAiProvider')) {
        document.getElementById('editAiProvider').addEventListener('change', (e) => {
            const baseUrlGroup = document.getElementById('editBaseUrlGroup');
            if (e.target.value === 'openai-compatible') {
                baseUrlGroup.style.display = 'block';
            } else {
                baseUrlGroup.style.display = 'none';
            }
        });
    }

    if (document.getElementById('saveAiConfig')) {
        document.getElementById('saveAiConfig').addEventListener('click', async () => {
            const aiConfig = {
                provider: document.getElementById('aiProvider').value,
                apiKey: document.getElementById('aiApiKey').value.trim(),
                model: document.getElementById('aiModel').value.trim()
            };

            const baseUrl = document.getElementById('aiBaseUrl').value.trim();
            if (baseUrl) {
                aiConfig.baseUrl = baseUrl;
            }

            if (!aiConfig.apiKey) {
                showAlert('ai-tab', '请填写 API Key', 'error');
                return;
            }

            try {
                await apiRequest('/config', {
                    method: 'POST',
                    body: { aiConfig }
                });

                // 更新本地状态
                state.config.aiProvider = aiConfig.provider;
                state.config.aiModel = aiConfig.model;
                state.config.hasApiKey = true;
                if (aiConfig.baseUrl) {
                    state.config.aiBaseUrl = aiConfig.baseUrl;
                }

                // 刷新 AI 配置显示
                updateAiConfigDisplay();

                showAlert('ai-tab', '✅ AI 配置已保存', 'success');
            } catch (error) {
                showAlert('ai-tab', `❌ 保存失败: ${error.message}`, 'error');
            }
        });
    }

    if (document.getElementById('testAiConfig')) {
        document.getElementById('testAiConfig').addEventListener('click', async () => {
            const provider = document.getElementById('aiProvider').value;
            const apiKey = document.getElementById('aiApiKey').value.trim();
            const baseUrl = document.getElementById('aiBaseUrl').value.trim();
            const model = document.getElementById('aiModel').value.trim();

            if (!apiKey) {
                showAlert('ai-tab', '请填写 API Key', 'error');
                return;
            }

            if (!model) {
                showAlert('ai-tab', '请填写模型名称', 'error');
                return;
            }

            if (provider === 'openai-compatible' && !baseUrl) {
                showAlert('ai-tab', 'OpenAI 兼容 API 需要填写 Base URL', 'error');
                return;
            }

            const testResultEl = document.getElementById('testResult');
            testResultEl.style.display = 'block';
            testResultEl.innerHTML = `
                <div style="padding: 15px; background: #d1ecf1; color: #0c5460; border-radius: 10px;">
                    <span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span>
                    正在测试连接，请稍候...
                </div>
            `;

            try {
                const response = await apiRequest('/test-ai', {
                    method: 'POST',
                    body: { provider, apiKey, baseUrl, model }
                });

                const data = response.data;
                testResultEl.innerHTML = `
                    <div style="padding: 15px; background: #d4edda; color: #155724; border-radius: 10px;">
                        <h4 style="margin: 0 0 10px 0;">✅ 连接测试成功!</h4>
                        <div style="font-size: 0.9rem; line-height: 1.6;">
                            <div><strong>提供商:</strong> ${data.provider}</div>
                            <div><strong>模型:</strong> ${data.model}</div>
                            <div><strong>响应:</strong> ${data.response}</div>
                            ${data.usage ? `<div><strong>Token 用量:</strong> ${data.usage.input_tokens || 0} + ${data.usage.output_tokens || 0}</div>` : ''}
                        </div>
                    </div>
                `;

                showAlert('ai-tab', '✅ AI 配置测试通过', 'success');

            } catch (error) {
                testResultEl.innerHTML = `
                    <div style="padding: 15px; background: #f8d7da; color: #721c24; border-radius: 10px;">
                        <h4 style="margin: 0 0 10px 0;">❌ 连接测试失败</h4>
                        <div style="font-size: 0.9rem;">
                            <div><strong>错误:</strong> ${error.message}</div>
                            ${error.details ? `<div style="margin-top: 10px;"><strong>详情:</strong><pre style="background: rgba(0,0,0,0.1); padding: 10px; border-radius: 5px; overflow-x: auto; margin-top: 5px;">${JSON.stringify(error.details, null, 2)}</pre></div>` : ''}
                        </div>
                    </div>
                `;

                showAlert('ai-tab', `❌ 测试失败: ${error.message}`, 'error');
            }
        });
    }

    // 系统设置事件 - 一键自动同步按钮
    if (document.getElementById('autoSyncAuthBtn')) {
        document.getElementById('autoSyncAuthBtn').addEventListener('click', async () => {
            const btn = document.getElementById('autoSyncAuthBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>⏳</span> 启动中...';
            btn.disabled = true;

            try {
                // 显示提示信息
                showAlert('settings-tab', '🚀 正在启动浏览器，请在弹出的窗口中完成阿里云登录...', 'info');

                // 读取当前配置获取 region
                const configResp = await apiRequest('/config');
                if (!configResp.success) throw new Error('获取配置失败');

                // 调用自动同步接口
                const result = await apiRequest('/auto-sync-auth', {
                    method: 'POST',
                    body: {
                        region: configResp.data.region || 'cn-beijing'
                    },
                    timeout: 180000 // 3 分钟超时
                });

                if (result.success) {
                    showAlert('settings-tab', `✅ ${result.message} (Cookies: ${result.cookies || 0}, CSRF: ${result.hasCsrf ? '✓' : '✗'})`, 'success');

                    // 更新认证状态显示
                    const authStatusEl = document.getElementById('authStatus');
                    authStatusEl.className = 'auth-status valid';
                    authStatusEl.innerHTML = '<span class="icon">✅</span><span>认证有效</span>';
                } else {
                    showAlert('settings-tab', result.error || '自动同步失败', 'error');
                }
            } catch (error) {
                console.error('自动同步错误:', error);
                showAlert('settings-tab', '❌ 自动同步失败: ' + error.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // 系统设置事件 - 验证认证状态按钮
    if (document.getElementById('syncAuthBtn')) {
        document.getElementById('syncAuthBtn').addEventListener('click', async () => {
            const btn = document.getElementById('syncAuthBtn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>⏳</span> 验证中...';
            btn.disabled = true;

            try {
                // 读取当前配置
                const configResp = await apiRequest('/config');
                if (!configResp.success) throw new Error('获取配置失败');

                // 调用同步认证接口验证当前配置
                const result = await apiRequest('/sync-auth', {
                    method: 'POST',
                    body: {
                        region: configResp.data.region || 'cn-beijing'
                    }
                });

                if (result.success) {
                    showAlert('settings-tab', result.message, result.valid ? 'success' : 'error');

                    // 直接根据验证结果更新认证状态显示
                    const authStatusEl = document.getElementById('authStatus');
                    if (result.valid) {
                        authStatusEl.className = 'auth-status valid';
                        authStatusEl.innerHTML = '<span class="icon">✅</span><span>认证有效</span>';
                    } else {
                        authStatusEl.className = 'auth-status invalid';
                        authStatusEl.innerHTML = '<span class="icon">⚠️</span><span>认证已失效</span>';
                    }
                } else {
                    showAlert('settings-tab', result.error || '同步失败', 'error');
                }
            } catch (error) {
                showAlert('settings-tab', '同步失败: ' + error.message, 'error');
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    if (document.getElementById('parseCurlBtn')) {
        document.getElementById('parseCurlBtn').addEventListener('click', async () => {
            const curlCommand = document.getElementById('curlInput').value.trim();

            if (!curlCommand) {
                showAlert('settings-tab', '请粘贴 curl 命令', 'error');
                return;
            }

            try {
                const parsed = parseCurlCommand(curlCommand);

                // 调试信息
                console.log('解析结果:', parsed);

                // 检查是否解析到有效数据
                const hasCookies = Object.keys(parsed.cookies).length > 0;
                const hasCsrf = !!parsed.csrfToken;

                if (!hasCookies && !hasCsrf) {
                    showAlert('settings-tab', '⚠️ 未能从 curl 命令中解析出认证信息，请确认复制了完整的命令', 'error');
                    return;
                }

                await apiRequest('/sync-auth', {
                    method: 'POST',
                    body: parsed
                });

                document.getElementById('curlInput').value = '';
                showAlert('settings-tab', `✅ 认证信息已同步 (Cookies: ${Object.keys(parsed.cookies).length}, CSRF: ${hasCsrf ? '✓' : '✗'})`, 'success');
                loadAuthStatus();
            } catch (error) {
                console.error('同步错误:', error);
                showAlert('settings-tab', `❌ 同步失败: ${error.message}`, 'error');
            }
        });
    }

    // 日志分析事件
    if (document.getElementById('analyzeBtn')) {
        document.getElementById('analyzeBtn').addEventListener('click', async () => {
            const projectId = document.getElementById('projectSelect').value;
            const timeRange = document.getElementById('timeRangeSelect').value;
            const query = document.getElementById('queryInput').value.trim();
            const size = parseInt(document.getElementById('sizeSelect').value);

            if (!projectId) {
                showAlert('analyze-tab', '请先选择一个项目', 'error');
                return;
            }

            showLoading('analyzeLoading');
            document.getElementById('analyzeResult').innerHTML = '';

            try {
                console.log('[DEBUG] 开始分析...', { projectId, timeRange, query, size });
                const response = await apiRequest('/analyze', {
                    method: 'POST',
                    body: { projectId, timeRange, query, size }
                });
                console.log('[DEBUG] 分析完成', response.data);
                console.log('[DEBUG] AI 分析:', response.data.aiAnalysis ? '存在' : '不存在');

                renderAnalysisResult(response.data);
                console.log('[DEBUG] 渲染完成');
            } catch (error) {
                showAlert('analyze-tab', `❌ 分析失败: ${error.message}`, 'error');
            } finally {
                hideLoading('analyzeLoading');
            }
        });
    }

    // 报告管理事件
    if (document.getElementById('refreshReports')) {
        document.getElementById('refreshReports').addEventListener('click', loadReports);
    }

    console.log('事件监听器绑定完成');
    console.log('所有初始化完成！');
});

// 将需要在 HTML 中调用的函数暴露到全局作用域
window.deleteProject = deleteProject;
window.viewReport = viewReport;
window.deleteReport = deleteReport;
