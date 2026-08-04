# Bookmark Assistant - Chrome 扩展

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web_Store-yellow?logo=google-chrome)](https://chrome.google.com/webstore)
[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/qiaodamao/bookmark-assistant)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> 本项目完全由 AI 生成，您可自由修改演绎。

## 概述

Bookmark Assistant 是专为 <a href="https://github.com/qiaodamao/cloudnav" target="_blank">cloudnav</a> 个人导航网站设计的 Chrome 浏览器扩展，支持快速保存书签到您的个人导航站点。扩展完全独立，可发布到 Chrome 商店，支持多种部署平台。

## ✨ 核心功能

### 🔗 链接保存

- **当前页面保存** - 一键保存当前浏览的页面
- **自定义链接** - 手动输入标题、URL、说明
- **智能图标获取** - 支持 4 种图标获取方式
- **分类管理** - 支持二级目录分类

### 🌐 多平台支持

- **EdgeOne** - 腾讯云 EdgeOne Pages（推荐，支持二级目录）
- **Cloudflare** - Cloudflare Pages（兼容原始版本）
- **即将支持** - Vercel、Aliyun ESA

### 🔐 安全特性

- **密码验证** - 支持访问密码保护
- **本地存储** - 配置信息安全存储在本地
- **HTTPS 安全** - 所有通信均使用 HTTPS 加密

### ⚡ 用户体验

- **连接测试** - 配置前可测试连接有效性
- **实时分类加载** - 从服务器动态加载最新分类
- **智能表单验证** - 实时检查输入完整性
- **响应式设计** - 适配不同屏幕尺寸

## 📁 目录结构

```
extensions/
└── chrome-extension/          # Chrome 扩展目录
    ├── manifest.json          # Manifest V3 配置文件
    ├── popup.html              # 弹窗界面（响应式设计）
    ├── popup.js                # 主要业务逻辑（ES6+）
    ├── background.js           # 后台服务工作者
    ├── icons/                  # 扩展图标集
    │   ├── icon16.png          # 16x16px - 浏览器工具栏
    │   ├── icon32.png          # 32x32px - Windows扩展页面
    │   ├── icon48.png          # 48x48px - 扩展管理页面
    │   └── icon128.png         # 128x128px - 商店展示
    ├── README.md               # 使用文档
    ├── chrome-store.md         # 商店发布指南
    └── generate-icons.js       # 图标生成脚本（Node.js）
```

## 🚀 安装方法

### 从 Chrome 商店安装（推荐）

> 📌 即将上架 Chrome 商店，敬请期待！

### 开发者模式安装

1. **下载扩展**

   ```bash
   git clone https://github.com/qiaodamao/bookmark-assistant.git
   cd bookmark/extensions/chrome-extension
   ```

2. **安装到 Chrome**
   - 打开 Chrome 浏览器
   - 访问 `chrome://extensions/`
   - 开启右上角的"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `chrome-extension` 文件夹

## ⚙️ 配置指南

### 基础配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API 地址 | 您的 cloudnav 部署域名 | `nav.example.com` |
| 部署平台 | 选择部署平台 | `EdgeOne` / `Cloudflare` |
| 访问密码 | 环境变量中的 PASSWORD | `your-secure-password` |

### EdgeOne 平台配置示例

```javascript
{
  "apiUrl": "nav.example.com",
  "platform": "edgeone",
  "password": "your-password",
  "showSubcategories": true
}
```

### Cloudflare 平台配置示例

```javascript
{
  "apiUrl": "nav.example.com",
  "platform": "cloudflare",
  "password": "your-password",
  "showSubcategories": false
}
```

## 🎯 图标获取方式

扩展支持 4 种图标获取方式：

### 1. Favicon Extractor（默认）

```javascript
// URL 模式 - 使用完整 URL
https://faviconextractor.com/api/favicon/url/https://example.com

// Domain 模式 - 使用域名
https://faviconextractor.com/api/favicon/domain/example.com
```

### 2. Google API

```javascript
https://www.google.com/s2/favicons?domain=example.com&sz=64
```

### 3. 自定义 API

```
https://your-api.com/favicon?url=https://example.com
```

### 4. 自定义 URL

```
https://example.com/icon.png
```

## 📖 使用教程

### 1. 首次配置

1. 点击扩展图标打开设置页面
2. 填写 API 地址（不含 http://或 https://）
3. 选择部署平台
4. 输入访问密码
5. 点击"测试连接"验证配置
6. 保存配置

### 2. 保存当前页面

1. 浏览到要保存的网页
2. 点击扩展图标
3. 确认页面信息（自动获取标题和 URL）
4. 选择分类（支持二级目录）
5. 点击"保存"

### 3. 添加自定义链接

1. 选择"自定义"保存类型
2. 填写标题、URL 和说明（可选）
3. 选择图标获取方式
4. 选择目标分类
5. 点击"保存"

## 🔧 开发指南

### 本地开发

```bash
# 修改代码后，在Chrome中重新加载扩展
# 1. 访问 chrome://extensions/
# 2. 找到cloudnav扩展
# 3. 点击刷新按钮
```

### 调试技巧

- **弹窗调试**：右键扩展图标 → 检查弹出内容
- **后台调试**：在扩展管理页点击"服务工作进程" → "查看"
- **日志查看**：使用 Chrome 开发者工具的 Console 面板

### 代码规范

- 使用 ES6+ 语法
- 遵循异步编程最佳实践
- 完整的错误处理机制
- 详细的代码注释

## 📋 API 接口

### 获取分类列表

```http
GET https://nav.example.com/api/storage?getConfig=true&readOnly=true
Headers: { "x-auth-password": "your-password" }
```

### 保存链接

```http
POST https://nav.example.com/api/storage
Headers: {
  "Content-Type": "application/json",
  "x-auth-password": "your-password"
}
Body: {
  "saveConfig": "links",
  "links": [
    {
      "id": "1640995200000",
      "title": "示例网站",
      "url": "https://example.com",
      "description": "网站说明",
      "icon": "https://example.com/icon.png",
      "categoryId": "common",
      "createdAt": "2021-12-31T16:00:00.000Z"
    }
  ]
}
```

### 平台差异

#### EdgeOne API

- 支持完整的分类和二级目录功能
- 使用最新的 API 格式
- 推荐用于新部署

#### Cloudflare API（原始版本）

- 兼容原始项目
- 支持基本分类功能
- 适合现有用户迁移

## 🔒 隐私与安全

### 隐私保护

- ✅ 不收集任何个人信息
- ✅ 所有配置本地存储
- ✅ 不向第三方发送数据
- ✅ 仅访问用户配置的网站
- ✅ 仅访问当前标签页的标题和 URL

### 安全措施

- 🔒 HTTPS 加密通信
- 🔒 密码验证机制
- 🔒 最小权限原则
- 🔒 定期安全更新

## 🔧 故障排除

### 无法保存书签

1. 检查 API 地址是否正确
2. 确认密码是否正确
3. 验证 cloudnav 网站是否正常运行

### 分类加载失败

1. 确认选择的平台是否正确
2. EdgeOne 用户请确保网站支持二级目录
3. Cloudflare 用户请使用原始 API 格式

### 权限问题

1. 确保插件有访问 activeTab 权限
2. 确保有访问目标域名的权限

### 图标不显示

1. 尝试切换图标获取方式
2. 检查网络连接
3. 验证图标 API 是否可用

## 📦 发布指南

### 商店发布清单

- [x] 完整功能实现
- [x] 多平台兼容
- [x] 安全代码审查
- [ ] 商店截图准备
- [ ] 隐私政策页面
- [ ] 用户支持渠道

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/qiaodamao/bookmark-assistant.git

# 安装开发依赖
npm install

# 生成图标（可选）
node generate-icons.js
```

### 提交规范

- 使用清晰的提交信息
- 遵循现有代码风格
- 添加必要的测试
- 更新相关文档

## 📞 技术支持

### 常见问题

1. **连接失败** - 检查 API 地址和密码配置
2. **分类加载失败** - 确认网络连接和 API 可用性
3. **图标不显示** - 尝试切换图标获取方式
4. **保存失败** - 检查分类选择和权限设置

### 获取帮助

- 🐛 [报告 Bug](https://github.com/qiaodamao/bookmark-assistant/issues)
- 💡 [功能建议](https://github.com/qiaodamao/bookmark-assistant/discussions)
- 📧 [联系我们](mailto:support@example.com)

## 🔗 相关链接

- **主项目**: <a href="https://github.com/qiaodamao/cloudnav" target="_blank">cloudnav</a>
- **在线演示**: [Demo](https://nav.shijuefuhao.com)
- **Chrome 扩展开发**: [官方文档](https://developer.chrome.com/docs/extensions/)
- **Manifest V3**: [迁移指南](https://developer.chrome.com/docs/extensions/mv3/intro/)

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

<div align="center">
  <p>🌟 如果这个项目对您有帮助，请给我们一个 Star！</p>
  <p>Made with ❤️ by cloudnav Team</p>
</div>
