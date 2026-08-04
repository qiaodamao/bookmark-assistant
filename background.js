// Bookmark Extension Background Script
// Manifest V3 Service Worker

// 监听插件安装
chrome.runtime.onInstalled.addListener(() => {
  console.log('Bookmark Extension installed');

  // 设置默认配置
  chrome.storage.sync.set({
    bookmarkConfig: {
      apiUrl: '',
      platform: 'edgeone',
      password: '',
      showSubcategories: false
    }
  });
});

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTabInfo') {
    // 获取当前活动标签页信息
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
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里添加自动保存或书签检测逻辑
    console.log('Tab updated:', tab.url);
  }
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.bookmarkConfig) {
    console.log('Config updated:', changes.bookmarkConfig.newValue);
  }
});