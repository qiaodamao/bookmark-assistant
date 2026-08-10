// Bookmark Extension Background Script
// Manifest V3 Service Worker

// 加载 tldts 库（用于提取根域名 eTLD+1，与 popup 的重复检测逻辑保持一致）
importScripts('vendor/tldts.min.js');

// ========== 常量 ==========
const CACHE_KEY = 'savedDomainsCache';       // 已保存书签的根域名集合
const CACHE_TIME_KEY = 'savedDomainsCacheTime'; // 缓存时间戳
const CACHE_TTL = 6 * 60 * 60 * 1000;         // 缓存有效期：6 小时
const ALARM_NAME = 'refreshDomains';          // 定时刷新缓存的 alarm 名称
const REFRESH_INTERVAL_MIN = 30;              // 定时刷新间隔：30 分钟

const DEFAULT_ICON = {
  '16': 'icons/icon16.png',
  '32': 'icons/icon32.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png'
};

// 带红点图标的 ImageData 缓存（service worker 重启后会丢失，按需重建）
let dottedIconsCache = null;

// ========== 配置读取 ==========
function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['bookmarkConfig'], (result) => {
      resolve(result.bookmarkConfig || {});
    });
  });
}

function getApiUrl(config) {
  if (!config.apiUrl) return null;
  return `https://${config.apiUrl}/api/storage`;
}

function createAuthHeaders(config) {
  const headers = new Headers();
  headers.append('x-auth-password', config.password || '');
  headers.append('Content-Type', 'application/json');
  return headers;
}

// 提取根域名（eTLD+1），与 popup.js 中 getRootDomain 逻辑一致
function getRootDomain(url) {
  if (!url) return '';
  try {
    const root = tldts.getDomain(url);
    if (root && typeof root === 'string') return root.toLowerCase();
    const u = new URL(url.trim());
    return (u.hostname || '').toLowerCase();
  } catch (e) {
    try {
      const u = new URL(url.trim());
      return (u.hostname || '').toLowerCase();
    } catch (_) {
      return (url || '').trim().toLowerCase();
    }
  }
}

// ========== 缓存管理 ==========
function getCachedDomains() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY, CACHE_TIME_KEY], (result) => {
      resolve({
        domains: result[CACHE_KEY] || [],
        time: result[CACHE_TIME_KEY] || 0
      });
    });
  });
}

function setCachedDomains(domains) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [CACHE_KEY]: domains,
      [CACHE_TIME_KEY]: Date.now()
    }, resolve);
  });
}

// 从服务器拉取 links，提取根域名并写入缓存
// force=false 时若缓存未过期则直接复用
async function refreshDomainsCache(force = false) {
  const config = await getConfig();
  if (!config.apiUrl || !config.password) {
    return [];
  }

  if (!force) {
    const { domains, time } = await getCachedDomains();
    if (Date.now() - time < CACHE_TTL) {
      return domains;
    }
  }

  const apiUrl = getApiUrl(config);
  try {
    const response = await fetch(`${apiUrl}?getConfig=links`, {
      method: 'GET',
      headers: createAuthHeaders(config)
    });
    if (!response.ok) {
      // 拉取失败时保留旧缓存，避免误清空
      const { domains } = await getCachedDomains();
      return domains;
    }
    let links = await response.json();
    if (!Array.isArray(links)) links = [];

    const domainSet = new Set();
    links.forEach(link => {
      if (link && link.url) {
        const root = getRootDomain(link.url);
        if (root) domainSet.add(root);
      }
    });
    const arr = Array.from(domainSet);
    await setCachedDomains(arr);
    return arr;
  } catch (e) {
    console.error('Failed to refresh domains cache:', e);
    const { domains } = await getCachedDomains();
    return domains;
  }
}

// ========== 图标管理 ==========

// 动态生成带红点的图标 ImageData（按尺寸生成并缓存）
async function getDottedIcons() {
  if (dottedIconsCache) return dottedIconsCache;

  const sizes = [16, 32, 48, 128];
  const imageDataMap = {};

  for (const size of sizes) {
    try {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // 绘制基础图标
      const url = chrome.runtime.getURL(`icons/icon${size}.png`);
      const response = await fetch(url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      ctx.drawImage(bitmap, 0, 0, size, size);
      bitmap.close();

      // 右下角绘制红点，贴着底部和右侧
      const r = size * 0.32;
      const cx = size - r;
      const cy = size - r;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      // 白色描边，提升对比度（内描边，避免被画布裁切）
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      imageDataMap[size] = ctx.getImageData(0, 0, size, size);
    } catch (e) {
      console.error('Failed to generate dotted icon for size', size, e);
    }
  }

  dottedIconsCache = imageDataMap;
  return imageDataMap;
}

async function setDottedIcon(tabId) {
  try {
    const icons = await getDottedIcons();
    await chrome.action.setIcon({ imageData: icons, tabId });
    await chrome.action.setTitle({ title: '该网站已添加到书签', tabId });
  } catch (e) {
    console.error('Failed to set dotted icon:', e);
  }
}

async function setNormalIcon(tabId) {
  try {
    await chrome.action.setIcon({ path: DEFAULT_ICON, tabId });
    await chrome.action.setTitle({ title: 'Bookmark Assistant', tabId });
  } catch (e) {
    // 标签页可能已关闭，忽略
  }
}

// 检查当前页是否已添加，并更新该标签页的图标
async function checkAndUpdateBadge(tabId, url) {
  // 仅处理 http(s) 页面
  if (!url || !/^https?:\/\//i.test(url)) {
    await setNormalIcon(tabId);
    return;
  }

  const config = await getConfig();
  if (!config.apiUrl || !config.password) {
    // 未配置，不显示标记
    await setNormalIcon(tabId);
    return;
  }

  const currentRoot = getRootDomain(url);
  // 排除源站本身：访问导航站源站时不显示红点
  const siteRoot = getRootDomain(config.apiUrl);
  if (siteRoot && currentRoot === siteRoot) {
    await setNormalIcon(tabId);
    return;
  }

  const { domains, time } = await getCachedDomains();

  // 缓存为空或过期时，后台异步刷新（本次先用现有缓存判断）
  if (domains.length === 0 || Date.now() - time > CACHE_TTL) {
    refreshDomainsCache(true);
  }

  if (currentRoot && domains.includes(currentRoot)) {
    await setDottedIcon(tabId);
  } else {
    await setNormalIcon(tabId);
  }
}

// ========== 事件监听 ==========

// 插件安装/更新
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Extension installed');
  refreshDomainsCache(true);

  // 创建定时刷新任务，定期同步主站最新书签（感知删除等变更）
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MIN });

  // 设置默认配置（保留原有逻辑）
  chrome.storage.sync.get(['bookmarkConfig'], (result) => {
    if (!result.bookmarkConfig) {
      chrome.storage.sync.set({
        bookmarkConfig: {
          apiUrl: '',
          platform: 'edgeone',
          password: '',
          showSubcategories: false
        }
      });
    }
  });
});

// 浏览器启动时刷新缓存
chrome.runtime.onStartup.addListener(() => {
  refreshDomainsCache(true);
  // 确保定时器存在（service worker 重启后 alarm 仍保留，这里做幂等保护）
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: REFRESH_INTERVAL_MIN });
});

// 定时刷新：感知主站的删除等变更，刷新后重检当前标签页
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await refreshDomainsCache(true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      await checkAndUpdateBadge(tab.id, tab.url);
    }
  } catch (e) {
    // 忽略
  }
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          title: tabs[0].title,
          url: tabs[0].url,
          favIconUrl: tabs[0].favIconUrl
        });
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true; // 保持消息通道开放
  }

  if (request.action === 'refreshDomainsCache') {
    // 保存书签后，popup 通知刷新缓存，并重新检查当前标签页
    refreshDomainsCache(true).then(async (domains) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
          await checkAndUpdateBadge(tab.id, tab.url);
        }
      } catch (e) {
        // 忽略
      }
      sendResponse({ success: true, count: domains.length });
    });
    return true;
  }
});

// 标签页加载完成时检查
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    checkAndUpdateBadge(tabId, tab.url);
  }
});

// 切换标签页时检查当前活动标签
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      await checkAndUpdateBadge(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // 忽略
  }
});

// 配置变化时刷新缓存（用户修改了 API 地址或密码）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bookmarkConfig) {
    const newValue = changes.bookmarkConfig.newValue;
    const oldValue = changes.bookmarkConfig.oldValue;
    // 仅在 apiUrl 或 password 变化时刷新
    if (!oldValue || newValue.apiUrl !== oldValue.apiUrl || newValue.password !== oldValue.password) {
      refreshDomainsCache(true);
    }
  }
});
