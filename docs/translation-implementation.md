# 翻译功能实现方案

## 1. 概述

将translation目录下的Python翻译脚本功能集成到Electron应用中，使用Node.js + Google Gemini API实现翻译功能。

## 2. 配置文件设计

### `translation-config.json` (项目根目录)

```json
{
  "intensities": {
    "detailed": {
      "name": "详细",
      "promptFile": "translation/claude-translation-prompt.md"
    },
    "basic": {
      "name": "基础",
      "promptFile": "translation/claude-translation-prompt.md"
    }
  },
  "sources": {
    "gemini": {
      "name": "Gemini",
      "model": "gemini-2.5-flash",
      "apiKeyEnv": "GOOGLE_API_KEY"
    }
  },
  "default": {
    "intensity": "detailed",
    "source": "gemini"
  }
}
```

**配置说明：**
- `intensities`: 解析强度配置，支持扩展
  - `name`: UI显示名称
  - `promptFile`: 提示词文件路径（相对项目根目录）
- `sources`: 翻译来源配置，支持扩展
  - `name`: UI显示名称
  - `model`: 使用的模型名称
  - `apiKeyEnv`: API密钥对应的环境变量名
- `default`: 默认设置

## 3. 技术栈

- **Google Gemini API**: `@google/generative-ai`
- **配置管理**: Node.js fs模块
- **UI组件**: React + Ant Design (Modal, Radio)

## 4. 文件结构

```
read-translate/
├── translation-config.json           # 翻译配置文件
├── translation/
│   ├── translate-node.js            # Node.js测试脚本
│   ├── claude-translation-prompt.md # Prompt文件
│   └── ...
├── electron/
│   └── services/
│       └── translationService.js    # 翻译服务
├── src/
│   ├── components/
│   │   ├── MainLayout.tsx           # 添加设置按钮
│   │   └── TranslationSettingsModal.tsx  # 设置弹窗
│   └── types/
│       ├── electron.d.ts            # 添加配置相关接口
│       └── translation.d.ts         # 翻译类型定义
├── electron.js                       # 修改translateSegment handler
└── preload.js                       # 添加配置IPC接口
```

## 5. 实施步骤

### 步骤1: 安装依赖
```bash
npm install @google/generative-ai
```

### 步骤2: 创建配置文件
创建`translation-config.json`在项目根目录

### 步骤3: 实现Node.js翻译脚本（测试）
在`translation/translate-node.js`中实现：
- 读取配置文件
- 加载prompt文件
- 调用Gemini API
- 解析JSON响应
- 测试通过后再集成到项目

### 步骤4: 创建翻译服务
`electron/services/translationService.js`:
- `loadConfig()`: 加载配置
- `loadPrompt(filePath)`: 读取prompt文件
- `translate(text, intensity, source)`: 执行翻译
- `extractJSON(response)`: 解析响应

### 步骤5: 修改Electron主进程
`electron.js`:
- 替换`segments:translate`的Mock实现
- 添加`translation:getConfig`获取配置
- 添加`translation:saveConfig`保存配置

### 步骤6: 更新preload接口
`preload.js`:
- 添加`getTranslationConfig()`
- 添加`saveTranslationConfig(config)`

### 步骤7: 创建UI组件
`TranslationSettingsModal.tsx`:
- 读取配置动态生成选项
- Radio选择intensity和source
- 保存设置到配置文件

### 步骤8: 集成到主界面
`MainLayout.tsx`:
- 在Header按钮栏左侧添加"翻译设置"按钮
- 点击打开TranslationSettingsModal

## 6. API调用流程

```
用户点击翻译
  → 前端调用 window.electronAPI.translateSegment(text)
  → preload转发到 'segments:translate'
  → electron.js handler调用 translationService.translate()
  → translationService读取当前配置
  → 加载对应的prompt文件
  → 调用Google Gemini API
  → 解析JSON响应 { translation, notes, language }
  → 返回 { translatedText, notes }
  → 前端接收并显示
```

## 7. 错误处理

- API密钥未设置：提示用户设置环境变量
- API调用失败：显示错误信息，支持重试
- 配置文件损坏：使用默认配置
- Prompt文件不存在：抛出错误

## 8. 进度显示

在翻译过程中显示加载状态：
- 前端：使用Ant Design的message.loading()
- 显示"正在翻译..."
- 完成后自动关闭

## 9. 测试计划

1. **Node.js脚本测试**
   - 测试API调用
   - 测试JSON解析
   - 测试错误处理

2. **集成测试**
   - 测试配置读取
   - 测试翻译功能
   - 测试设置保存

3. **UI测试**
   - 测试设置弹窗
   - 测试选项显示
   - 测试设置持久化

## 10. 扩展性

通过修改配置文件即可扩展：
- 添加新的解析强度：在`intensities`中添加新项
- 添加新的翻译来源：在`sources`中添加新项
- 修改默认设置：更新`default`配置

## 11. 安全性

- API密钥从环境变量读取，不写入配置文件
- 配置文件不包含敏感信息
- 支持通过`.env`文件或系统环境变量设置密钥
