# AGENTS.md

> **注意：此文件仅供 Codex 本地使用，任何对 AGENTS.md 的修改都不应提交到 GitHub。**
> 该文件已加入 .gitignore，请勿手动 `git add AGENTS.md`。

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

### 项目分析 + 可评审原型交付（2026-06-30）

- 基于当前代码结构梳理了登录页、主工作台、文件编辑区、Git 管理、Extensions/知识库、设置弹窗 6 个核心界面
- 新增 `docs/prototype/stackssh-client-prototype.html`：
  - 独立静态原型，无需启动项目即可打开查看
  - 顶部切换不同页面原型，便于逐屏讨论修改点
  - 每个页面附带热点标注和“当前实现特征 / 建议评审点”
- 新增 `docs/prototype/README.md` 说明原型入口
- 本次未改动业务代码，目标是先帮助确认界面方向，再决定具体 UI/交互改造范围

### 原型视觉迭代 + 三主题切换（2026-06-30）

- 重构 `docs/prototype/stackssh-client-prototype.html` 的全局样式体系：
  - 从单套硬编码样式改为语义化 CSS 变量 + `data-theme` 主题覆盖
  - 新增 3 套主题：`default-gray`、`github-light`、`github-dark`
- 顶部工具栏新增全局主题切换器，可实时对比 3 个主题效果
- 设置页原型切换到“外观”视图，新增主题卡片区，与顶部切换共用同一状态
- 使用 `localStorage` 记忆主题选择，刷新页面后保留上次主题
- 对登录页、工作台、文件区、Git、Extensions、设置页做了一轮轻量视觉统一：
  - 统一卡片圆角、阴影、边框强度和高亮语言
  - 强化主工作区与侧栏层级，减少“只是换底色”的感觉
  - 保留原有信息架构和页面内容，不改业务逻辑，仅服务于视觉评审

### 前端视觉方向落地（2026-07-01）

- 将真实前端主题系统收敛为 3 套：
  - `dark` → 默认灰色
  - `light` → GitHub 白
  - `midnight` → GitHub 黑
- `themeStore.ts`：
  - 删除 `forest` 主题
  - 调整 3 套主题 token，使其更贴近原型确认后的视觉方向
  - 默认主题改为 `dark`
- `LoginView.tsx`：
  - 登录页接入全局主题色，不再写死浅色卡片
  - 深色主题下增加更贴近桌面工具的背景与登录卡风格
  - 按钮、输入框、错误提示全部跟随主题
- `Settings.tsx`：
  - 外观页重做为 3 套主题卡片选择器，增强预览感
  - 顶栏、底栏、导航圆角和层级统一
  - 主题描述文案与视觉预览同步，便于继续确认正式默认主题
- `Header.tsx`、`ActivityBar.tsx`：
  - 顶栏改用更稳定的 title bar 色层
  - 按钮、选中态、边框和圆角更贴近新原型风格
- 验证：
  - `npm run build` 构建成功

### 对话 403 修复 — 裸 fetch 漏带 JWT ✅（2026-06-11）

**根因**：C1 用户认证只给 `request.ts` 的通用方法加了 `Authorization` header，4 处绕过 request.ts 的裸 fetch 没有带 token，被服务端 Spring Security 拦截返回 403：

1. `api/agent.ts` `reactChatStream()` — **对话 SSE 流**（用户报错的直接原因；chatStream 委托给它，一并修复）
2. `api/sshFile.ts` `downloadFileUrl()` — `<a href>` 直链下载无法带 header，改为追加 `&token=` query 参数（服务端 JwtAuthFilter.resolveToken 本身支持 query 参数）
3. `components/SFTPWorkspace.tsx` — 拖拽下载的流式 fetch，加 Bearer header
4. `components/Settings.tsx` — 服务器连接测试 fetch，加 Bearer header（否则登录后测试永远显示失败）

**注意**：JWT 过期后所有请求也会 403，重新登录即可；后续可考虑 401/403 时自动跳登录页。

### 自定义应用图标 + AI 对话 Logo 更换 ✅（2026-06-11）

- 设计源文件 `src-tauri/app-icon.svg`：蓝色渐变圆角方块（#3B82F6→#1D4ED8）+ 白色终端提示符 `>_`（与登录页 Logo 风格一致）
- 用 sharp（新增 devDependency）将 SVG 渲染为 `src-tauri/app-icon.png`（1024）和 `public/logo.png`（512，替换原 2.6MB 机器人图）
- `npx tauri icon src-tauri/app-icon.png` 重新生成全套图标（Windows ico / macOS icns / iOS / Android），任务栏图标在下次 `tauri dev/build` 后生效
- `RightSidebar.tsx` 两处 logo `<img>` 去掉重度 opacity（品牌图不再做弱化处理）
- 重新生成图标的命令：`node` 用 sharp 渲染 SVG → `npx tauri icon src-tauri/app-icon.png`

### 终端工具栏精简 + AI 对话 Codex 风格 + Git 分支管理 ✅（2026-06-11）

#### 1. 终端命令历史右侧化 + 删除快照/录制

- `TerminalPanel.tsx`：
  - 命令历史面板从浮层（absolute overlay）改为终端右侧固定 flex 面板（w-72，不遮挡终端，xterm 自动 refit）
  - 删除"导出终端快照 / 开始录制 / 查看录制列表"工具栏按钮及全部相关代码（state、handler、录制列表弹窗、回放弹窗、TerminalPlayback 引用）
  - `api/terminal.ts` 中录制 API 保留未删（服务端对接代码不动，仅去掉 UI 入口）

#### 2. AI 对话 Codex 风格渲染

- 新增 `src/components/MessageMarkdown.tsx`：基于 react-markdown + remark-gfm 的完整 Markdown 渲染器
  - 代码块：语言标签头部栏 + 复制按钮（JetBrains Mono）
  - 支持标题/列表/表格/引用/分隔线/链接，全部走主题色
- `RightSidebar.tsx` MessageBubble 重构：
  - AI 回复：去掉气泡，全宽直接渲染在面板背景上（Codex 风格）；ReAct 步骤收纳进浅色圆角卡片
  - 用户消息：右对齐浅蓝 accentSoft 气泡（rounded-2xl）
  - 删除原有正则版 formatMarkdown + dangerouslySetInnerHTML
- 新增依赖：`react-markdown`、`remark-gfm`

#### 3. 左侧栏 Git 分支管理

- 新增 `src/components/GitPanel.tsx`：
  - 通过专用隐藏终端会话（openTerminal + execCommand，模块级 gitSessions 缓存）在远程执行 git 命令，不干扰用户可见终端
  - 功能：仓库路径输入（localStorage 按连接持久化）、当前分支+ahead/behind+暂存/修改/未跟踪计数、分支列表点击切换、新建分支、Pull/Fetch/刷新、最近 15 条提交
  - 输出解析容忍 shell echo/prompt 噪声（正则按行匹配）
- `ActivityBar.tsx`：新增第 5 个 tab（git，分支图标），TabId 增加 'git'
- `LeftSidebar.tsx`：tabLabels + 渲染分支接入 GitPanel
- `MainView.tsx`：git tab 激活时中间区域复用终端视图（与 servers 相同）

**验证**：`tsc --noEmit` 零错误，`npm run build` 构建成功。

### F6 用户登录界面 + B2 WebSocket 终端客户端 ✅（2026-06-11）

#### F6 用户登录界面

**新增文件：**
1. `src/api/auth.ts` — login / register API
2. `src/stores/authStore.ts` — JWT 持久化到 localStorage，`getToken()` 全局导出
3. `src/views/LoginView.tsx` — GitHub 风格登录/注册表单，支持模式切换

**修改文件：**
- `src/App.tsx`：根据 `useAuthStore().isAuthenticated` 决定显示 LoginView 还是 MainView
- `src/api/request.ts`：`request()` 和 `postFormData()` 均自动加 `Authorization: Bearer <token>` header；新增 `getWsBaseUrl()` 工具函数（http→ws 协议转换）
- `src/components/Header.tsx`：右上角新增用户名显示和退出登录按钮
- `vite.config.ts`：新增 `/ws` WebSocket proxy（`ws: true`，target: ws://localhost:8091）

#### B2 WebSocket 终端客户端

**修改文件：**
- `src/components/TerminalPanel.tsx`：
  - `ConnectionTerminalState` 中 `pollTimer` → `ws: WebSocket | null`
  - `startPolling()` → `startWebSocket(state, sessionId)`：创建 WS 连接到 `/ws/terminal?sessionId=xxx&token=xxx`
  - `stopPolling()` → `closeWebSocket(state)`：安全关闭 WS
  - `onData` 输入合批后通过 `state.ws.send()` 发送（替代 HTTP POST）
  - `handleDangerConfirm` 中危险命令确认/取消同样走 WS 发送

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

### RAG 知识库客户端 ✅（2026-06-10）

**新建文件：**
- `src/api/knowledge.ts` — upload/list/delete/search API
- `src/components/KnowledgeBase.tsx` — 知识库管理面板组件

**修改文件：**
- `src/api/agent.ts`：`reactChatStream` 新增 `connectionId` 参数，带入请求体
- `src/components/RightSidebar.tsx`：发送时透传 `connectionId`（活跃连接）
- `src/components/LeftSidebar.tsx`：extensions tab 底部追加 `<KnowledgeBase>` 独立分区

**UI 功能：**
- 拖拽/点击上传 txt/md 文件，即时反馈上传状态
- 文档列表：状态徽章（处理中/就绪/失败）、块数、删除按钮
- 处理中状态轮询刷新（2s 间隔）
- 按当前连接过滤 / 全局视图切换

### 右侧 AI 对话 — 多模型切换（2026-06-03）

- `RightSidebar.tsx`：模型配置面板重构为多模型切换
- 8 个内置预设（DeepSeek/GPT/Qwen/Codex），点击一键切换并推服务端
- 自定义配置存 localStorage，支持保存 / 应用 / 删除
- 新增 `ModelProfile` 接口 + `MODEL_PRESETS` + `loadStoredProfiles` / `persistProfiles`

### 原型改版：AI 中心化 + 全局字号上调 + Codex 风格任务流 ✅（2026-07-01）

- 修改 `docs/prototype/stackssh-client-prototype.html`
- 全局字号体系上调一级，连同行高、pill、tab、输入区、注释气泡一起放大，重点覆盖登录页、工作台、文件页、Git、Extensions、设置页与 AI 面板
- 右侧 AI 面板从普通聊天栏改成“AI 任务中心”：
  - 新增当前会话 / 绑定连接 / 执行模型 / 上下文状态四块摘要
  - 新增模型配置、历史记录、上下文管理等控制条
  - 对话内容改成参考 Codex 的 `Thinking / Tool Call / Tool Result / Recommended next action` 任务流样式
  - 输入区补充命令历史、MCP、Skill 等上下文标签
- Git 原型改成 “AI-assisted remote repository workspace” 叙事：
  - 强调其属于 SSH + AI 工作流，不是独立 Git 客户端
  - 增加 AI 可协助的 Git 动作说明，放大提交与输出区字号
- Extensions 原型改成能力中心叙事：
  - MCP = 外部工具能力
  - Skills = 工作流能力
  - RAG = 知识上下文
  - 补充每块的角色说明文案与更清晰的层级
- Settings 原型新增“产品定位说明”区，明确 `AI 主入口 + SSH 执行底座 + 模型/RAG/MCP/Skills 能力层` 的产品表达
- 尝试使用 Codex in-app browser 复查 `file://` 原型页，但该地址被浏览器策略拦截，最终以静态检查确认修改结果

### 前端落地：AI 中心化视觉升级 + 全局字号上调 ✅（2026-07-01）

- 基于已确认的原型，直接修改真实前端代码：
  - `src/views/LoginView.tsx`
  - `src/components/RightSidebar.tsx`
  - `src/components/LeftSidebar.tsx`
  - `src/components/GitPanel.tsx`
  - `src/components/Settings.tsx`
- 登录页：
  - 标题、副标题、表单、错误提示、按钮字号整体上调一级
  - 品牌文案从单纯“AI SSH 智能终端”强化为“AI SSH 智能终端与远程执行工作台”
- 右侧 AI 面板：
  - 从普通聊天栏升级为“AI 任务中心”
  - 新增当前会话、执行模型、绑定连接、Agent 能力组合四块摘要
  - 增加新建会话、模型配置、历史记录、上下文管理等控制条
  - ReAct 步骤改成更接近 Codex 的 `Thinking / Tool Call / Tool Result` 轻量过程流
  - 用户消息、思考中态、输入框、上下文标签、发送快捷键区统一放大字号并收敛聊天感
- 左侧 Extensions：
  - 升级成“AI 能力中心”叙事，补充 MCP / Skills / RAG 的角色说明
  - 表单、说明卡片、保存按钮字号整体上调
  - 保存按钮文案改成“保存能力组合”
- Git 面板：
  - 强化“AI 协助的远程仓库工作台”定位说明
  - 分支、提交、输出与操作区字号整体上调
  - 保留现有功能，不改远程 git 执行逻辑
- 设置页：
  - 外观页新增“产品定位说明”卡片
  - 主题卡片与说明字号上调，强化 AI 主入口 + SSH 执行底座的产品表达
- 验证：
  - `npm run build` 构建成功

### 页面级打磨：Header / ActivityBar / Terminal / Workbench 统一视觉 ✅（2026-07-01）

- 本轮继续在真实前端做页面级打磨，重点统一工作台骨架的层级、字号和控件尺寸：
  - `src/components/Header.tsx`
  - `src/components/ActivityBar.tsx`
  - `src/components/TerminalPanel.tsx`
  - `src/views/MainView.tsx`
- Header：
  - 顶栏高度、按钮热区、连接信息卡、用户区整体放大
  - AI 按钮文案调整为“AI 任务中心”，更贴近产品定位
  - 顶栏边界与阴影更明确，层次感更接近原型
- ActivityBar：
  - 左侧图标栏加宽并补充品牌位
  - 当前激活态改成更明确的胶囊卡片 + 左侧高亮指示
  - 设置按钮与主导航按钮统一尺寸和圆角语言
- Terminal：
  - xterm 字号从 `13` 提到 `14`
  - 终端 tab、搜索栏、命令历史、命令辅助、断连提示、危险命令确认框整体放大一级
  - 命令历史面板宽度从 `w-72` 提到 `w-80`，提升可读性
- MainView：
  - 文件工作台工具栏从 `h-9` 提到 `h-11`
  - 终端/分屏切换按钮、文件 tab、下拉文件列表统一为更大的圆角与字号
  - 分割条 hover 视觉从蓝色浮层改成跟主题 accent 一致的轻高亮
- 验证：
  - `npm run build` 构建成功

### AI 面板精简：移除顶部说明头 ✅（2026-07-01）

- 根据评审反馈，移除 `src/components/RightSidebar.tsx` 顶部“AI 任务中心 / Codex-style”说明头
- 保留下方真正有用的摘要卡片与操作按钮：
  - 当前会话
  - 执行模型
  - 绑定连接
  - Agent 能力组合
- 目的：减少重复产品说明，让右侧 AI 面板更直接进入任务信息本身
- 验证：
  - `npm run build` 构建成功

### 顶栏微调：对话入口改名 + 用户区去边框 ✅（2026-07-01）

- 调整 `src/components/Header.tsx`
- 将顶部 `AI 任务中心` 按钮文案改为 `对话agent`
- 去掉右上角用户区外层边框，保留浅背景容器，减少视觉干扰
- 同时顺手清理了该文件里的局部乱码文本，统一为正常中文
- 验证：
  - `npm run build` 构建成功

### 对话结束后仍停留“思考中”修复 ✅（2026-07-01）

- 联合排查 `stackssh-server` 与 `stackssh-client` 的 ReAct SSE 对话收口逻辑：
  - 服务端 `UserFeedbackNode` 确认会发送 `done` 事件并 `emitter.complete()`
  - 根因落在前端 `src/api/agent.ts`：此前只在 `ReadableStream.read()` 返回 `done=true` 时才调用 `onDone`
  - 当最终回答已经通过 `done` 事件到达、但连接尾部没有及时关闭时，`RightSidebar.tsx` 的 `isLoading` 一直不被置回 `false`，输入框持续禁用
- 修复：
  - 重写 `reactChatStream()` 的结束收口逻辑
  - 收到 `done` 事件时立即执行 `onDone`，并主动 `abort()` 当前流
  - 增加 `settled` 守卫，避免 `done`、流关闭、异常回调重复触发
  - `error` 事件和 fetch/read 异常统一走 `failStream()`，确保错误场景也能正确解锁输入框
- 影响文件：
  - `src/api/agent.ts`

### 左侧栏标签精简 + 固定宽度 ✅（2026-07-01）

- 根据界面调整需求，去掉 2 处视觉标签：
  - `src/components/GitPanel.tsx`：移除“AI + SSH” pill
  - `src/components/LeftSidebar.tsx`：移除“AI Center” pill
- `src/views/MainView.tsx`：
  - 将左侧栏宽度固定为 `260px`
  - 移除左侧栏右边的拖拽分隔条
  - 删除对应的 sidebar resize state 和鼠标拖拽逻辑，避免再被用户手动改宽

### 左侧栏固定宽度调整为 380px ✅（2026-07-01）

- `src/views/MainView.tsx`
  - 将 `FIXED_SIDEBAR_WIDTH` 从 `260` 调整为 `380`
  - 保持左侧栏仍为固定宽度，继续禁止拖动修改
