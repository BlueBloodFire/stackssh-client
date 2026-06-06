# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

stackssh-client 是 AI SSH 智能终端的桌面客户端，基于 **Tauri 2 + React 19 + TypeScript** 构建，提供终端、文件管理、AI 对话等 IDE 风格界面。

- 框架：Tauri 2.x · React 19 · Vite 7 · TypeScript 5.8
- 后端依赖：stackssh-server（默认 http://localhost:8091）

---

## 构建 & 运行

```bash
# 安装依赖
npm install

# 开发模式（启动 Vite + Tauri Dev）
npm run tauri dev
# 或使用脚本
docs/dev-ops/start-dev.bat   # Windows
docs/dev-ops/start-dev.sh    # Mac/Linux

# 生产构建
npm run tauri build

# 仅前端（无 Tauri，用于调试 UI）
npm run dev
```

**注意**：先启动 stackssh-server，再启动客户端。开发模式下 Vite 代理 `/api/v1` → `http://localhost:8091`。

---

## 目录结构

```
src/
  api/         ← HTTP 客户端（每个资源一个文件）
  components/  ← UI 组件（纯展示 + 交互逻辑混合）
  stores/      ← Zustand 全局状态
  views/       ← 页面级容器（仅 MainView）
  types/       ← 共享 TypeScript 接口
src-tauri/     ← Rust 后端（目前只注册了 greet 示例命令）
```

---

## 架构模式

### 布局层次

```
MainView（全屏布局容器）
  ├── Header（顶栏）
  ├── ActivityBar（左侧图标栏，4 个 tab）
  ├── LeftSidebar（tab 内容：servers / files / sftp / extensions）
  ├── 中间主区域（随 activeTab 切换：终端 / 文件 / SFTP）
  └── RightSidebar（AI 对话面板，可隐藏/拖拽宽度）
```

`MainView` 持有布局状态（侧边栏宽度、终端可见性等），通过 props 向下传递。

### 状态管理（Zustand）

| Store | 职责 |
|-------|------|
| `agentStore` | 智能体列表、会话 Map、消息历史、ReAct 步骤 |
| `connectionStore` | SSH 连接 CRUD、心跳检测、当前选中连接 |
| `sshAgentStore` | 智能体↔终端绑定、输入框 context tags |
| `fileExplorerStore` | 文件树（按 connectionId 分组）、打开的 tab 列表 |
| `themeStore` | 主题（dark/light/多套）|

**模式**：组件通过 `useXxxStore()` 取 state 和 action，不通过 props 透传。跨组件通信优先放 store，不用 Context。

### API 层

- 所有 HTTP 请求走 `src/api/request.ts` 的 `get()` / `post()`
- 统一响应格式 `{code: '0000'|err, info, data}`，由各 API 文件封装成类型安全方法
- SSE 流式对话在 `api/agent.ts` 的 `reactChatStream()` 中用 `fetch` + `ReadableStream` 实现，逐行解析 JSON 事件

### SSE 事件类型

后端推送纯 JSON 行（无 `data:` 前缀）：

```typescript
type ReActEvent =
  | { event: 'text';       content?: string; fullText?: string }
  | { event: 'tool_call';  toolCallId: string; toolName: string }
  | { event: 'tool_result'; toolCallId: string; content: string; status: string }
  | { event: 'round_end';  stepInfo: { currentStep, maxSteps, totalToolCalls } }
  | { event: 'done';       content?: string }
  | { event: 'error';      content?: string }
```

---

## UI 约定

- **无组件库**：所有样式用 Tailwind CSS + 内联 `style` 传入 `colors` 主题色
- 主题色从 `useThemeStore()` 取 `colors` 对象，不硬编码颜色值
- 文字大小常用 `text-[11px]` / `text-[13px]`，不用 Tailwind 预设尺寸
- 按钮 `transition-colors`，hover 用 `hover:bg-white/5` 或 `hover:opacity-80`

---

## 待实现功能路线图

> 按优先级排列，调用时直接引用对应条目编号。

### A. 终端增强

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| A1 | **终端多标签页** | 同一连接开多个终端 tab，独立 sessionId，xterm.js 实例复用 | 低 |
| A2 | **终端内搜索** | Ctrl+F 触发，使用 `@xterm/addon-search`（依赖已在 xterm 生态中）高亮匹配 | 低 |
| A3 | **命令历史面板** | 侧边栏展示已执行命令列表，点击一键重执行或插入输入框 | 低 |
| A4 | **终端录制/回放** | 前端配合服务端 B1，播放 asciinema 格式录制文件 | 中 |
| A5 | **终端快照** | 将当前终端滚动缓冲区导出为 `.txt` 文件 | 低 |
| A6 | **终端分屏** | 水平/垂直分割多个终端实例（已有布局框架可复用） | 中 |

### B. AI 能力扩展

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| B1 | **AI Playbook** | 将对话保存为可命名剧本，支持一键重放，展示在左侧面板 | 中 |
| B2 | **命令解释模式** | 输入框旁增加"解释"按钮，发送前先让 AI 解释命令风险 | 低 |
| B3 | **AI 命令补全** | 终端输入时触发 AI 建议浮层，基于历史命令和当前上下文 | 中 |
| B4 | **服务器知识库** | Extensions 标签下增加"笔记"区，按连接保存 AI 备忘（本地或服务端） | 中 |
| B5 | **对话历史搜索** | RightSidebar 增加搜索栏，跨会话搜索历史消息内容 | 中 |
| B6 | **多智能体并行面板** | 同时向多台服务器发起 Agent 任务，并排展示结果 | 高 |
| B7 | **定时巡检查看** | 查看/管理服务端配置的定时 AI 巡检任务及结果 | 中 |

### C. 文件系统增强

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| C1 | **远程文件搜索** | 左侧面板增加搜索框，执行远端 `grep`/`find`，结果列表点击定位 | 低 |
| C2 | **文件 Diff 视图** | Monaco 编辑器 Diff 模式，对比本地草稿与远端文件 | 中 |
| C3 | **文件权限编辑器** | 右键菜单增加"修改权限"，可视化选择 rwx 位并执行 `chmod` | 低 |
| C4 | **压缩包操作** | 右键菜单"解压到此处"/"打包选中文件" | 低 |
| C5 | **批量操作** | 文件树多选（Ctrl+Click），支持批量删除/移动/下载 | 低 |

### D. 连接管理增强

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| D1 | **连接分组/标签** | 左侧面板支持拖拽分组、颜色标签，折叠展开 | 低 |
| D2 | **连接导入/导出** | 导出为 JSON，支持从 SecureCRT/MobaXterm 格式导入 | 低 |
| D3 | **跳板机配置** | 连接编辑框增加 ProxyJump 配置项 | 中 |
| D4 | **私钥管理器** | 专用面板管理 SSH 私钥，不直接在连接表单中粘贴 | 中 |
| D5 | **快速连接** | 检测剪贴板中 `ssh user@host` 格式，自动弹出连接提示 | 低 |
| D6 | **连接模板** | 预定义连接参数模板（相同配置的服务器批量创建） | 低 |

### E. 监控与可观测

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| E1 | **实时监控面板** | 新增"监控"Tab，轮询服务端指标接口，Chart.js 展示 CPU/内存/磁盘趋势 | 中 |
| E2 | **日志流式视图** | 新增"日志"面板，SSE 接收服务端 `tail -f` 推送，关键词高亮 | 中 |
| E3 | **进程管理器** | 可视化展示进程列表（`ps aux`），支持搜索和 kill | 低 |
| E4 | **端口扫描视图** | 列出监听端口及进程，可点击查看进程详情 | 低 |

### F. 客户端体验

| # | 功能 | 说明 | 难度 |
|---|------|------|------|
| F1 | **全局命令调板升级** | Ctrl+P 搜索连接/命令/会话/文件，`CommandPalette` 组件已有骨架 | 中 |
| F2 | **状态栏** | 底部常驻栏：当前连接 · AI 模型 · 服务端延迟 · 会话状态 | 低 |
| F3 | **主题自定义** | 允许用户在 Settings 中自定义配色，保存到 localStorage | 低 |
| F4 | **快捷键配置** | Settings 增加快捷键映射管理页面 | 中 |
| F5 | **操作审计日志** | 本地展示服务端返回的 `ssh_session_log` 执行历史 | 低 |
| F6 | **用户登录界面** | 配合服务端 C1（用户认证），增加登录页和 JWT 存储 | 高 |
| F7 | **Webhook 通知配置** | UI 配置钉钉/飞书 Webhook 地址，AI 发现异常时触发推送 | 中 |

---

## 工作规范

- **每次完成一条指令后，立即更新本文件** —— 在"进度记录"节追加
- 大任务拆分为小任务，逐步完成
- Context 接近上限时先 `/compact` 再继续

---

## 进度记录

### ActivityBar 新增 Extensions 入口（2026-06-03）

- `ActivityBar.tsx` 新增第 4 个 tab（MCPs & Skills，星形图标）

### 左侧 Extensions 标签 — MCPs + Skills 管理（2026-06-03）

- `LeftSidebar.tsx`：extensions tab 替换为完整工具管理 UI
- 支持 MCP（SSE/Stdio/Local）和 Skill（resource/directory）的增删查
- 保存后调用 `updateToolsConfig` 推送到服务端重新装配

### 刷新/断线 UX 修复（2026-06-04）

- `connectionStore.disconnect()`：API 失败（服务端不可达）时也强制本地 `status → DISCONNECTED`，避免连接看起来已连但终端断开的状态不一致

### A 终端增强全部实现（2026-06-04）

- **A1 终端多标签**：`TerminalPanel.tsx` 重构，引入 `globalTerminalTabs`/`globalActiveTabId` 模块级存储，每个连接可开多个独立标签，`+` 新建，`×` 关闭，标签状态指示器（红/绿/黄）
- **A2 终端内搜索**：安装 `@xterm/addon-search`，Ctrl+F 触发搜索栏，支持上/下方向搜索
- **A3 命令历史面板**：`globalCommandHistory` 按连接存储最近 200 条命令，点击"插"插入输入框，点击"▶"直接执行
- **A4 终端录制回放**：新增 `TerminalPlayback.tsx` 组件，支持播放/暂停/停止/速度调节（0.5x/1x/2x/5x），进度条显示；与服务端 B1 对接
- **A5 终端快照**：工具栏"下载"按钮，遍历 `buffer.active` 导出 `.txt` 文件（浏览器下载）
- **B3 危险命令拦截（客户端侧）**：Enter 键前 async 调用 `/check-command`，危险命令弹出确认框（取消发 Ctrl+C，确认发 Enter）
- 新增 `src/api/terminal.ts` 中：`checkCommand`、`startRecording`、`stopRecording`、`listRecordings`、`getRecordingPlayback` 函数

### 右侧 AI 对话 — 多模型切换（2026-06-03）

- `RightSidebar.tsx`：模型配置面板重构为多模型切换
- 8 个内置预设（DeepSeek/GPT/Qwen/Claude），点击一键切换并推服务端
- 自定义配置存 localStorage，支持保存 / 应用 / 删除
- 新增 `ModelProfile` 接口 + `MODEL_PRESETS` + `loadStoredProfiles` / `persistProfiles`
