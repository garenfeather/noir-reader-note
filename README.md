# ReadTranslate - 翻译阅读器

EPUB 阅读器，支持翻译模式和只读模式。

## 启动应用

```bash
# 安装依赖
npm install

# 方式 1：使用 concurrently（推荐）
npm run electron:dev

# 方式 2：分别启动
# 终端 1
npm run dev

# 终端 2
npx electron .
```

## 当前功能（Phase 1）

- ✅ Electron + React + TypeScript 项目结构
- ✅ 三列布局（目录/内容/翻译面板）
- ✅ EPUB 文件打开和解析
- ✅ 只读模式基本功能
  - 翻页（上一页/下一页）
  - 目录导航
  - 模式切换（只读/翻译）
  - 右侧面板折叠

## 使用说明

1. 启动应用后，点击顶部"打开 EPUB"按钮
2. 选择一个 .epub 文件
3. 左侧显示目录，中间显示内容，右侧为翻译面板
4. 使用底部的翻页按钮进行阅读
5. 点击"翻译模式"/"只读模式"切换模式

## 项目结构

```
read-translate/
├── electron.js              # Electron 主进程
├── preload.js              # Electron 预加载脚本
├── src/
│   ├── components/         # React 组件
│   │   ├── MainLayout.tsx  # 主布局
│   │   ├── TableOfContents.tsx  # 目录组件
│   │   ├── ContentViewer.tsx    # 内容展示组件
│   │   └── TranslationPanel.tsx # 翻译面板
│   ├── types/             # TypeScript 类型定义
│   ├── App.tsx            # 根组件
│   └── main.tsx           # React 入口
├── package.json
└── README.md
```

## 技术栈

- Electron
- React + TypeScript
- Ant Design
- TailwindCSS
- epub.js
- Vite

## 下一步开发（Phase 2）

- 自动文本分段
- 翻译API集成
- 翻译结果展示
- 工程管理
