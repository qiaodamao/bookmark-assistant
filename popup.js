// Bookmark Extension Main Script
class BookmarkExtension {
  constructor() {
    this.config = {
      apiUrl: '',
      platform: 'edgeone',
      password: '',
      showSubcategories: false
    };
    this.categories = [];
    this.subcategories = [];
    this.selectedCategory = '';
    this.selectedSubcategory = '';
    this.currentTab = null;
    this.linkType = 'current';
    this.customLink = {
      title: '',
      url: '',
      description: '',
      icon: '',
      iconType: 'faviconextractor'
    };
    this.pendingLinkData = null; // 重复检测时暂存的待保存数据

    this.init();
  }

  async init() {
    // 获取当前标签页信息
    await this.getCurrentTab();

    // 加载保存的配置
    await this.loadConfig();

    // 绑定事件
    this.bindEvents();

    // 更新页面信息显示
    this.updatePageInfo();

    // 如果配置完整，直接进入添加页面并加载分类
    if (this.isConfigured()) {
      this.toggleSection('save');
      await this.loadCategories();
    } else {
      // 没有配置时显示设置页面
      this.toggleSection('config');
    }
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  // 获取当前页面的 meta description
  // 优先级：meta[name=description] > meta[property=og:description] > 首段文本
  async getPageDescription() {
    if (!this.currentTab || !this.currentTab.id) return '';
    // chrome:// 等浏览器内部页面无法注入脚本
    if (/^(chrome|edge|about|chrome-extension):/i.test(this.currentTab.url || '')) return '';
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        func: () => {
          // 1. 标准 meta description
          const metaDesc = document.querySelector('meta[name="description"]')?.content;
          if (metaDesc && metaDesc.trim()) return metaDesc.trim();
          // 2. Open Graph 描述
          const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
          if (ogDesc && ogDesc.trim()) return ogDesc.trim();
          // 3. 文章首段文本（兜底）
          const firstP = document.querySelector('article p, main p, p');
          if (firstP && firstP.textContent && firstP.textContent.trim()) {
            return firstP.textContent.trim().slice(0, 200);
          }
          return '';
        }
      });
      return result?.result || '';
    } catch (error) {
      console.error('Failed to get page description:', error);
      return '';
    }
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['bookmarkConfig'], (result) => {
        if (result.bookmarkConfig) {
          this.config = { ...this.config, ...result.bookmarkConfig };
          this.updateConfigUI();
        }
        resolve();
      });
    });
  }

  saveConfig() {
    chrome.storage.sync.set({ bookmarkConfig: this.config });
  }

  saveConfigFromForm() {
    // 从表单获取配置
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const password = document.getElementById('password').value.trim();
    const platform = document.querySelector('input[name="platform"]:checked')?.value || 'edgeone';

    // 验证必填字段
    if (!apiUrl || !password) {
      this.showStatus('请填写完整的 API 地址和密码', 'error');
      return;
    }

    // 显示保存中状态
    const saveConfigBtn = document.getElementById('saveConfigBtn');
    const originalText = saveConfigBtn.innerHTML;
    saveConfigBtn.disabled = true;
    saveConfigBtn.innerHTML = `
      <div class="spinner"></div>
      <span>保存中...</span>
    `;

    this.showStatus('正在验证配置并获取分类...', 'testing');

    // 临时使用表单中的配置进行测试
    const originalConfig = { ...this.config };
    this.config.apiUrl = apiUrl;
    this.config.password = password;
    this.config.platform = platform;

    this.testApiConnection().then(async (success) => {
      if (success) {
        // 测试成功，保存配置
        this.config = {
          apiUrl: apiUrl,
          password: password,
          platform: platform,
          showSubcategories: this.config.showSubcategories
        };

        // 保存到本地存储
        this.saveConfig();

        // 确保分类已加载
        if (this.categories.length === 0) {
          await this.loadCategories();
        }

        this.showStatus('✅ 配置保存成功！', 'success');

        // 1.5 秒后自动切换到添加书签页面
        setTimeout(() => {
          this.toggleSection('save');
        }, 1500);
      } else {
        // 测试失败，恢复原始配置
        this.config = originalConfig;
        this.showStatus('❌ 配置验证失败，请检查设置', 'error');
      }
    }).catch((error) => {
      // 测试失败，恢复原始配置
      this.config = originalConfig;
      this.showStatus(`❌ 配置验证失败：${error.message}`, 'error');
    }).finally(() => {
      // 恢复保存按钮状态
      saveConfigBtn.disabled = false;
      saveConfigBtn.innerHTML = originalText;
    });
  }

  updateConfigUI() {
    document.getElementById('apiUrl').value = this.config.apiUrl;
    document.querySelector(`input[name="platform"][value="${this.config.platform}"]`).checked = true;
    document.getElementById('password').value = this.config.password;
  }

  updatePageInfo() {
    if (!this.currentTab) return;

    const titleInput = document.getElementById('pageTitleInput');
    const urlInput = document.getElementById('pageUrlInput');
    const descInput = document.getElementById('pageDescriptionInput');

    if (titleInput) titleInput.value = this.currentTab.title || '';
    if (urlInput) urlInput.value = this.currentTab.url || '';
    if (descInput) {
      descInput.value = '';
      descInput.placeholder = '正在获取页面描述...';
    }

    // 异步获取页面描述（不阻塞 UI）
    this.getPageDescription().then(description => {
      const currentDesc = document.getElementById('pageDescriptionInput');
      if (!currentDesc) return;
      // 仅在用户未手动输入时填充，避免覆盖用户编辑
      if (!currentDesc.value.trim() && description) {
        currentDesc.value = description;
        currentDesc.placeholder = '输入链接说明（可选）';
      } else if (!currentDesc.value.trim()) {
        // 获取失败或页面无描述：给出明确提示，不再显示"获取中"
        currentDesc.placeholder = '未获取到页面描述，可手动输入';
      }
    }).catch(() => {
      const currentDesc = document.getElementById('pageDescriptionInput');
      if (currentDesc && !currentDesc.value.trim()) {
        currentDesc.placeholder = '未获取到页面描述，可手动输入';
      }
    });
  }

  isConfigured() {
    return this.config.apiUrl && this.config.password;
  }

  bindEvents() {
    // 链接类型切换
    document.querySelectorAll('input[name="linkType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.linkType = e.target.value;
          this.toggleLinkTypeSection();
        }
      });
    });

    // 自定义链接输入
    document.getElementById('customTitle').addEventListener('input', (e) => {
      this.customLink.title = e.target.value;
      this.validateSaveForm();
    });

    document.getElementById('customUrl').addEventListener('input', (e) => {
      this.customLink.url = e.target.value;
      this.validateSaveForm();
    });

    document.getElementById('customDescription').addEventListener('input', (e) => {
      this.customLink.description = e.target.value;
    });

    // 图标类型选择
    const iconTypeSelect = document.getElementById('iconType');
    if (iconTypeSelect) {
      iconTypeSelect.addEventListener('change', (e) => {
        this.customLink.iconType = e.target.value;
        this.toggleIconInput(e.target.value);
      });
    }

  

    // 自定义图标 URL 输入
    const customIconInput = document.getElementById('customIcon');
    if (customIconInput) {
      customIconInput.addEventListener('input', (e) => {
        this.customLink.icon = e.target.value;
      });
    }

    // 预览图标按钮
    const previewIconBtn = document.getElementById('previewIconBtn');
    if (previewIconBtn) {
      previewIconBtn.addEventListener('click', () => {
        this.previewIcon();
      });
    }


    // 测试按钮
    document.getElementById('testBtn').addEventListener('click', () => {
      this.testConnection();
    });

    // 保存配置按钮
    document.getElementById('saveConfigBtn').addEventListener('click', () => {
      this.saveConfigFromForm();
    });

    // 净化网址按钮
    const cleanUrlBtn = document.getElementById('cleanUrlBtn');
    if (cleanUrlBtn) {
      cleanUrlBtn.addEventListener('click', () => {
        this.handleCleanUrl();
      });
    }

    // 分类选择
    document.getElementById('categorySelect').addEventListener('change', (e) => {
      const selectedId = e.target.value;
      if (!selectedId) {
        this.selectedCategory = '';
        this.selectedSubcategory = '';
      } else {
        // 判断选中的是一级还是二级分类
        const cat = this.categories.find(c => c.id === selectedId);
        if (cat && cat.parentId) {
          // 选中的是二级分类
          this.selectedSubcategory = selectedId;
          this.selectedCategory = cat.parentId;
        } else {
          // 选中的是一级分类
          this.selectedCategory = selectedId;
          this.selectedSubcategory = '';
        }
      }
      this.validateSaveForm();
    });

    // 重复警告：仍然添加（强制保存，跳过重复检测）
    const forceSaveBtn = document.getElementById('forceSaveBtn');
    if (forceSaveBtn) {
      forceSaveBtn.addEventListener('click', () => {
        this.hideDuplicateWarning();
        this.saveBookmark(true);
      });
    }

    // 重复警告：取消保存
    const cancelDuplicateBtn = document.getElementById('cancelDuplicateBtn');
    if (cancelDuplicateBtn) {
      cancelDuplicateBtn.addEventListener('click', () => {
        this.hideDuplicateWarning();
        this.showStatus('已取消保存', '');
      });
    }
  }

  toggleSection(section) {
    const configSection = document.getElementById('configSection');
    const saveSection = document.getElementById('saveSection');
    const settingsBtn = document.getElementById('settingsBtn');
    const saveBtn = document.getElementById('saveBtn');

    if (section === 'config') {
      // 显示设置页面
      configSection.style.display = 'block';
      saveSection.style.display = 'none';

      // 在设置页面隐藏所有底部按钮，只使用页面内的按钮
      saveBtn.style.display = 'none';
      settingsBtn.style.display = 'none';

      // 清除状态信息
      document.getElementById('status').textContent = '';
    } else {
      // 显示保存书签页面
      configSection.style.display = 'none';
      saveSection.style.display = 'block';

      // 设置按钮用于返回设置页面
      settingsBtn.className = 'btn btn-secondary';
      settingsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 1024 1024"><path fill="currentColor" d="M512.5 390.6c-29.9 0-57.9 11.6-79.1 32.8c-21.1 21.2-32.8 49.2-32.8 79.1s11.7 57.9 32.8 79.1c21.2 21.1 49.2 32.8 79.1 32.8s57.9-11.7 79.1-32.8c21.1-21.2 32.8-49.2 32.8-79.1s-11.7-57.9-32.8-79.1a110.96 110.96 0 0 0-79.1-32.8m412.3 235.5l-65.4-55.9c3.1-19 4.7-38.4 4.7-57.7s-1.6-38.8-4.7-57.7l65.4-55.9a32.03 32.03 0 0 0 9.3-35.2l-.9-2.6a442.5 442.5 0 0 0-79.6-137.7l-1.8-2.1a32.12 32.12 0 0 0-35.1-9.5l-81.2 28.9c-30-24.6-63.4-44-99.6-57.5l-15.7-84.9a32.05 32.05 0 0 0-25.8-25.7l-2.7-.5c-52-9.4-106.8-9.4-158.8 0l-2.7.5a32.05 32.05 0 0 0-25.8 25.7l-15.8 85.3a353.4 353.4 0 0 0-98.9 57.3l-81.8-29.1a32 32 0 0 0-35.1 9.5l-1.8 2.1a445.9 445.9 0 0 0-79.6 137.7l-.9 2.6c-4.5 12.5-.8 26.5 9.3 35.2l66.2 56.5c-3.1 18.8-4.6 38-4.6 57c0 19.2 1.5 38.4 4.6 57l-66 56.5a32.03 32.03 0 0 0-9.3 35.2l.9 2.6c18.1 50.3 44.8 96.8 79.6 137.7l1.8 2.1a32.12 32.12 0 0 0 35.1 9.5l81.8-29.1c29.8 24.5 63 43.9 98.9 57.3l15.8 85.3a32.05 32.05 0 0 0 25.8 25.7l2.7.5a448.3 448.3 0 0 0 158.8 0l2.7-.5a32.05 32.05 0 0 0 25.8-25.7l15.7-84.9c36.2-13.6 69.6-32.9 99.6-57.5l81.2 28.9a32 32 0 0 0 35.1-9.5l1.8-2.1c34.8-41.1 61.5-87.4 79.6-137.7l.9-2.6c4.3-12.4.6-26.3-9.5-35m-412.3 52.2c-97.1 0-175.8-78.7-175.8-175.8s78.7-175.8 175.8-175.8s175.8 78.7 175.8 175.8s-78.7 175.8-175.8 175.8"/></svg>
        设置
      `;
      settingsBtn.style.display = 'flex';
      settingsBtn.onclick = () => this.toggleSection('config');

      // 保存书签按钮 - 只要配置完整就显示
      if (this.isConfigured()) {
        saveBtn.style.display = 'flex';
        saveBtn.disabled = this.categories.length === 0; // 只在分类未加载时禁用
        // 确保按钮内容和事件正确
        saveBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path fill="currentColor" d="M10.414 1H1v14h14V5.586zM4 4h5v2H4zm8 5v4h-2v-2H6v2H4V9z"/></svg>
          ${this.categories.length === 0 ? '加载中...' : '保存'}
        `;
        saveBtn.onclick = () => this.saveBookmark();
      } else {
        saveBtn.style.display = 'none';
      }
    }
  }

  toggleLinkTypeSection() {
    const currentSection = document.getElementById('currentPageSection');
    const customSection = document.getElementById('customLinkSection');

    if (this.linkType === 'current') {
      currentSection.style.display = 'block';
      customSection.style.display = 'none';
    } else {
      currentSection.style.display = 'none';
      customSection.style.display = 'block';
    }

    this.validateSaveForm();
  }

  validateSaveForm() {
    const saveBtn = document.getElementById('saveBtn');
    let isValid = true;

    if (this.linkType === 'current') {
      isValid = this.currentTab && this.currentTab.url;
    } else {
      isValid = this.customLink.title && this.customLink.url;
    }

    isValid = isValid && this.selectedCategory;

    saveBtn.disabled = !isValid;
  }

  async testConnection() {
    const testBtn = document.getElementById('testBtn');
    const originalText = testBtn.innerHTML;

    // 从表单获取当前的配置值
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const password = document.getElementById('password').value.trim();
    const platform = document.querySelector('input[name="platform"]:checked')?.value || 'edgeone';

    // 验证必填字段
    if (!apiUrl || !password) {
      this.showStatus('请填写完整的 API 地址和密码', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.innerHTML = `
      <div class="spinner"></div>
      <span>测试中...</span>
    `;

    this.showStatus('正在测试连接...', 'testing');

    // 保存原始配置以便恢复
    const originalConfig = { ...this.config };

    try {
      // 临时使用表单中的配置进行测试
      this.config.apiUrl = apiUrl;
      this.config.password = password;
      this.config.platform = platform;

      const success = await this.testApiConnection();

      if (success) {
        // 测试成功，保持表单中的配置值
        this.config = {
          apiUrl: apiUrl,
          password: password,
          platform: platform,
          showSubcategories: this.config.showSubcategories
        };

        this.showStatus('✅ 连接成功！分类加载中...', 'success');
        await this.loadCategories();
        setTimeout(() => {
          this.showStatus('✅ 测试成功！您可以开始保存书签了。', 'success');
        }, 1000);
      } else {
        // 测试失败，恢复原始配置
        this.config = originalConfig;
      }
    } catch (error) {
      // 测试失败，恢复原始配置
      this.config = originalConfig;
      this.showStatus(`❌ 连接失败：${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = originalText;
    }
  }

  async testApiConnection() {
    const apiUrl = this.getApiUrl();

    try {
      // 测试连接时需要带上密码验证
      const response = await fetch(`${apiUrl}?getConfig=true&readOnly=true`, {
        method: 'GET',
        headers: this.createAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('密码验证失败，请检查密码是否正确');
        }
        if (response.status === 404) {
          throw new Error('API 地址不存在，请检查地址是否正确');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.categories = data.categories || [];

      // 提取二级目录
      this.subcategories = this.categories.filter(cat => cat.parentId);

      return true;
    } catch (error) {
      console.error('Test connection failed:', error);

      // 处理编码错误
      if (error.message.includes('non ISO-8859-1')) {
        throw new Error('密码包含特殊字符，请使用简单 ASCII 字符');
      }

      // 处理网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查地址是否正确或网络是否正常');
      }

      throw error;
    }
  }

  getApiUrl() {
    // 根据平台和域名构建 API URL
    const protocol = this.config.platform === 'edgeone' ? 'https://' : 'https://';
    return `${protocol}${this.config.apiUrl}/api/storage`;
  }

  // 创建带有正确编码的认证头部
  createAuthHeaders() {
    const headers = new Headers();
    headers.append('x-auth-password', this.config.password);
    headers.append('Content-Type', 'application/json');
    return headers;
  }

  async loadCategories() {
    const categorySelect = document.getElementById('categorySelect');
    const loadingEl = document.getElementById('categoryLoading');
    const saveBtn = document.getElementById('saveBtn');

    if (!categorySelect || !loadingEl) return;

    // 显示加载状态
    categorySelect.style.display = 'none';
    loadingEl.style.display = 'flex';

    try {
      const apiUrl = this.getApiUrl();

      let data;

      // 统一使用带密码验证的方式获取配置
      const response = await fetch(`${apiUrl}?getConfig=true&readOnly=true`, {
        method: 'GET',
        headers: this.createAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('密码验证失败，请检查密码是否正确');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      data = await response.json();

      this.categories = data.categories || [];
      this.subcategories = this.categories.filter(cat => cat.parentId);

      this.updateCategoriesUI();

      // 启用保存按钮并更新显示
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path fill="currentColor" d="M10.414 1H1v14h14V5.586zM4 4h5v2H4zm8 5v4h-2v-2H6v2H4V9z"/></svg>
        保存
      `;

      this.showStatus(`✅ 成功加载 ${this.categories.length} 个分类`, 'success');

    } catch (error) {
      console.error('Failed to load categories:', error);
      this.showStatus(`加载分类失败：${error.message}`, 'error');
    } finally {
      // 隐藏加载状态
      categorySelect.style.display = 'block';
      loadingEl.style.display = 'none';
    }
  }

  updateCategoriesUI() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;

    // 清空现有选项
    categorySelect.innerHTML = '<option value="">请选择分类</option>';

    // 排序：常用推荐在前，然后按创建时间
    const sortedTopCategories = this.categories
      .filter(cat => !cat.parentId)  // 只显示顶级分类
      .sort((a, b) => {
        if (a.id === 'common') return -1;
        if (b.id === 'common') return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

    // 逐个顶级分类渲染：先加一级分类选项（粗体深色），再追加其二级分类（缩进浅色）
    sortedTopCategories.forEach(topCat => {
      // 一级分类选项
      const topOption = document.createElement('option');
      topOption.value = topCat.id;
      topOption.textContent = topCat.name;
      topOption.style.fontWeight = '600';
      topOption.style.color = '#1f2937';
      categorySelect.appendChild(topOption);

      // 该一级分类下的二级分类
      const subs = this.subcategories
        .filter(sub => sub.parentId === topCat.id)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      subs.forEach(sub => {
        const subOption = document.createElement('option');
        subOption.value = sub.id;
        // 全角空格做缩进 + 树形符
        subOption.textContent = `　└ ${sub.name}`;
        subOption.style.color = '#6b7280';
        categorySelect.appendChild(subOption);
      });
    });
  }

  async saveBookmark(forceSave = false) {
    let linkData;

    // 隐藏之前可能存在的重复警告
    this.hideDuplicateWarning();

    if (this.linkType === 'current') {
      // 从输入框读取用户可能编辑过的值
      const titleInput = document.getElementById('pageTitleInput');
      const urlInput = document.getElementById('pageUrlInput');
      const descInput = document.getElementById('pageDescriptionInput');

      const title = titleInput?.value.trim() || this.currentTab?.title || '';
      const url = urlInput?.value.trim() || this.currentTab?.url || '';
      const description = descInput?.value.trim() || '';

      if (!url) {
        this.showStatus('无法获取当前页面 URL', 'error');
        return;
      }

      linkData = {
        id: Date.now().toString(), // 生成唯一 ID
        title: title || '无标题',
        url: url,
        description: description,
        icon: this.currentTab?.favIconUrl || '',
        categoryId: this.selectedSubcategory || this.selectedCategory || 'common', // 优先使用二级目录
        createdAt: new Date().toISOString()
      };
    } else {
      if (!this.customLink.title || !this.customLink.url) {
        this.showStatus('请填写标题和 URL', 'error');
        return;
      }

      // 获取图标 URL
      let iconUrl = null;
      try {
        iconUrl = await this.getIconUrl(this.customLink.url, this.customLink.iconType, this.customLink.icon);
      } catch (error) {
        console.error('Failed to get icon URL:', error);
      }

      linkData = {
        id: Date.now().toString(), // 生成唯一 ID
        title: this.customLink.title,
        url: this.customLink.url,
        description: this.customLink.description || '',
        icon: iconUrl || '',
        categoryId: this.selectedSubcategory || this.selectedCategory || 'common', // 优先使用二级目录
        createdAt: new Date().toISOString()
      };
    }

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <div class="spinner"></div>
      <span>保存中...</span>
    `;

    this.showStatus('正在保存...', 'testing');

    try {
      const apiUrl = this.getApiUrl();

      // 首先获取现有的 links 数据
      const getResponse = await fetch(`${apiUrl}?getConfig=links`, {
        method: 'GET',
        headers: this.createAuthHeaders()
      });

      if (!getResponse.ok) {
        throw new Error(`获取现有数据失败 (${getResponse.status}): ${getResponse.statusText}`);
      }

      let existingLinks = await getResponse.json();

      // 确保是数组格式
      if (!Array.isArray(existingLinks)) {
        existingLinks = [];
      }

      // 重复检测：非强制保存时检查 URL 是否已存在
      if (!forceSave) {
        const duplicate = this.findDuplicate(linkData.url, existingLinks);
        if (duplicate) {
          // 保存待添加数据并显示警告，等待用户确认
          this.pendingLinkData = linkData;
          this.showDuplicateWarning(duplicate);
          this.showStatus('检测到根域名已存在，请确认是否继续', 'testing');
          return; // finally 块会恢复保存按钮状态
        }
      }

      // 添加新链接到数组
      existingLinks.push(linkData);

      // 保存更新后的 links 数据
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: this.createAuthHeaders(),
        body: JSON.stringify({
          saveConfig: 'links',
          links: existingLinks
        })
      });

      if (response.ok) {
        // 获取保存到的分类名称
        let categoryName = '默认分类';
        if (this.selectedSubcategory) {
          const subcat = this.subcategories.find(cat => cat.id === this.selectedSubcategory);
          if (subcat) {
            const parent = this.categories.find(cat => cat.id === subcat.parentId);
            categoryName = parent ? `${parent.name} > ${subcat.name}` : subcat.name;
          }
        } else if (this.selectedCategory) {
          const cat = this.categories.find(cat => cat.id === this.selectedCategory);
          categoryName = cat ? cat.name : '默认分类';
        }

        // 清空自定义表单
        if (this.linkType === 'custom') {
          document.getElementById('customTitle').value = '';
          document.getElementById('customUrl').value = '';
          document.getElementById('customDescription').value = '';
          document.getElementById('customIcon').value = '';
          document.getElementById('iconType').value = 'faviconextractor';
          document.getElementById('iconPreview').innerHTML = '<span style="color: #9ca3af; font-size: 12px;">图标预览</span>';
          // 隐藏所有额外选项
          document.getElementById('customIcon').style.display = 'none';
          document.getElementById('faviconextractorOptions').style.display = 'block';

          this.customLink = {
            title: '',
            url: '',
            description: '',
            icon: '',
            iconType: 'faviconextractor'
          };
        }

        this.showStatus(`✅ 已保存到：${categoryName}`, 'success');
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `保存失败 (${response.status})`);
      }
    } catch (error) {
      console.error('Save bookmark failed:', error);
      this.showStatus(`❌ ${error.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16"><path fill="currentColor" d="M10.414 1H1v14h14V5.586zM4 4h5v2H4zm8 5v4h-2v-2H6v2H4V9z"/></svg>
        保存
      `;
    }
  }

  toggleIconInput(iconType) {
    const customIconInput = document.getElementById('customIcon');
    const faviconextractorOptions = document.getElementById('faviconextractorOptions');

    if (!customIconInput || !faviconextractorOptions) return;

    // 隐藏所有选项
    customIconInput.style.display = 'none';
    faviconextractorOptions.style.display = 'none';

    if (iconType === 'customapi' || iconType === 'customurl') {
      customIconInput.style.display = 'block';
      customIconInput.placeholder = iconType === 'customapi'
        ? '输入自定义 API 地址（可选）'
        : '输入自定义图标 URL（可选）';
    } else if (iconType === 'faviconextractor') {
      faviconextractorOptions.style.display = 'block';
    }
  }

  async previewIcon() {
    const iconPreview = document.getElementById('iconPreview');
    if (!iconPreview) return;

    const url = this.customLink.url;
    if (!url) {
      this.showStatus('请先输入 URL', 'error');
      return;
    }

    iconPreview.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div><span style="color: #6b7280; font-size: 12px;">获取中...</span>';

    try {
      const iconUrl = await this.getIconUrl(url, this.customLink.iconType, this.customLink.icon);

      if (iconUrl) {
        iconPreview.innerHTML = `
          <img src="${iconUrl}" alt="Icon" style="width: 24px; height: 24px; object-fit: contain;"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
          <span style="color: #9ca3af; font-size: 12px; display: none;">无法加载图标</span>
        `;
      } else {
        iconPreview.innerHTML = '<span style="color: #9ca3af; font-size: 12px;">无法获取图标</span>';
      }
    } catch (error) {
      console.error('Preview icon failed:', error);
      iconPreview.innerHTML = '<span style="color: #9ca3af; font-size: 12px;">获取图标失败</span>';
    }
  }

  async getIconUrl(url, iconType, customValue) {
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch (error) {
      console.error('Invalid URL:', url);
      return null;
    }

    switch (iconType) {
      case 'faviconextractor':
        // 使用默认的 faviconextractor API 格式
        try {
          const response = await fetch(`https://www.faviconextractor.com/favicon/${domain}?larger=true`);
          if (response.ok) {
            return `https://www.faviconextractor.com/favicon/${domain}?larger=true`;
          }
        } catch (error) {
          console.error('FaviconExtractor API failed:', error);
          // 降级到 Google favicon
          return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        }
        return `https://www.faviconextractor.com/favicon/${domain}?larger=true`;

      case 'google':
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

      case 'customapi':
        if (customValue) {
          try {
            const response = await fetch(`${customValue}?url=${encodeURIComponent(url)}`);
            if (response.ok) {
              const data = await response.json();
              return data.icon || data.url || data.favicon;
            }
          } catch (error) {
            console.error('Custom API failed:', error);
          }
        }
        return null;

      case 'customurl':
        return customValue || null;

      default:
        return null;
    }
  }

  // ========== URL 净化 ==========

  // 净化 URL：去除所有 query 参数和 hash，仅保留 origin + pathname
  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      // 只保留 origin + pathname，去除所有 query 参数和 hash
      let cleaned = urlObj.origin + urlObj.pathname;
      // 去除末尾多余的 /（但保留根路径的 /）
      if (cleaned.endsWith('/') && cleaned !== urlObj.origin + '/') {
        cleaned = cleaned.slice(0, -1);
      }
      return cleaned;
    } catch (e) {
      // 解析失败时原样返回
      return url;
    }
  }

  // 净化链接按钮点击处理
  handleCleanUrl() {
    if (!this.currentTab || !this.currentTab.url) return;
    const cleaned = this.cleanUrl(this.currentTab.url);
    // 如果已经是净化后的 URL，无需处理
    if (cleaned === this.currentTab.url) {
      this.showStatus('当前链接已是净化状态', '');
      return;
    }
    this.currentTab.url = cleaned;
    const urlInput = document.getElementById('pageUrlInput');
    if (urlInput) urlInput.value = cleaned;
    this.showStatus('✅ 已去除追踪参数', 'success');
  }

  // URL 规范化：用于重复检测时的统一比较
  normalizeUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url.trim());
      // 移除路径末尾斜杠，小写化主机名，保留协议/查询/锚点
      const path = u.pathname.replace(/\/+$/, '') || '/';
      return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}${u.hash}`;
    } catch (e) {
      // 非法 URL 退化为字符串比较
      return (url || '').trim().replace(/\/+$/, '');
    }
  }

  // 提取根域名（eTLD+1）：例如 www.example.com -> example.com，erji.example.co.uk -> example.co.uk
  // 依赖 tldts 库（vendor/tldts.min.js）。若库未加载或无法识别，回退到 hostname 本身。
  getRootDomain(url) {
    if (!url) return '';
    try {
      // tldts 可直接处理完整 URL，也可处理纯 hostname
      const root = tldts.getDomain(url);
      if (root && typeof root === 'string') {
        return root.toLowerCase();
      }
      // 回退：取 hostname 全部
      const u = new URL(url.trim());
      return (u.hostname || '').toLowerCase();
    } catch (e) {
      // tldts 未加载或解析失败，回退到 hostname 比较
      try {
        const u = new URL(url.trim());
        return (u.hostname || '').toLowerCase();
      } catch (_) {
        return (url || '').trim().toLowerCase();
      }
    }
  }

  // 在现有 links 中查找与给定 URL 重复的条目
  // 判重规则：根域名（eTLD+1）相同即视为重复
  findDuplicate(url, links) {
    if (!url || !Array.isArray(links)) return null;
    const root = this.getRootDomain(url);
    if (!root) return null;
    return links.find(link => link && link.url && this.getRootDomain(link.url) === root) || null;
  }

  // 简易 HTML 转义，防止用户数据破坏 DOM
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 根据分类 ID 解析出可读的分类名称
  getCategoryDisplayName(categoryId) {
    if (!categoryId) return '未知分类';
    const cat = this.categories.find(c => c.id === categoryId);
    if (cat) return cat.name;
    const subcat = this.subcategories.find(s => s.id === categoryId);
    if (subcat) {
      const parent = this.categories.find(c => c.id === subcat.parentId);
      return parent ? `${parent.name} > ${subcat.name}` : subcat.name;
    }
    return categoryId;
  }

  // 显示重复书签警告
  showDuplicateWarning(duplicate) {
    const warningEl = document.getElementById('duplicateWarning');
    const infoEl = document.getElementById('duplicateInfo');
    if (!warningEl || !infoEl) return;

    const categoryName = this.getCategoryDisplayName(duplicate.categoryId);
    const rootDomain = this.getRootDomain(duplicate.url);
    infoEl.innerHTML = `
      <div>标题：${this.escapeHtml(duplicate.title || '无标题')}</div>
      <div>所在分类：${this.escapeHtml(categoryName)}</div>
      <div>匹配根域名：<strong>${this.escapeHtml(rootDomain)}</strong></div>
    `;
    warningEl.style.display = 'flex';
  }

  // 隐藏重复书签警告
  hideDuplicateWarning() {
    const warningEl = document.getElementById('duplicateWarning');
    if (warningEl) warningEl.style.display = 'none';
    this.pendingLinkData = null;
  }

  showStatus(message, type = '') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;

    // 3 秒后清除状态（成功和错误信息）
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    }

    // 测试信息显示更长时间
    if (type === 'testing') {
      setTimeout(() => {
        if (statusDiv.textContent.includes('测试中...')) {
          statusDiv.textContent = '';
          statusDiv.className = 'status';
        }
      }, 5000);
    }
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new BookmarkExtension();
});
