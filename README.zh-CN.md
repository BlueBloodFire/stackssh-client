# StackSSH Client

[English](./README.md)

`stackssh-client` 是 StackSSH 的桌面工作台客户端。

它提供 IDE 风格的 SSH 运维界面，把终端、AI 对话、远程文件管理和终端工作流整合在一起，而真正的 SSH 执行与 AI 编排则交给 `stackssh-server` 处理。

## 它是什么

StackSSH Client 不是一个传统意义上的 SSH 图形工具。

它更像一个 **AI 原生的远程运维工作台**，包含：

- 以终端为中心的工作区
- 右侧 AI 任务面板
- 远程文件与 SFTP 视图
- 面向 Git 工作流的支持
- 基于 Tauri 的可主题化桌面体验

## 核心体验

### 终端工作台

- 打开和管理 SSH 终端会话
- 多标签终端工作流
- 命令历史辅助
- 终端内容搜索
- 危险命令确认流程
- 基于 WebSocket 的终端交互

### AI 任务中心

- 与面向运维场景的 AI Agent 对话
- 流式查看多步 ReAct 执行过程
- 查看工具调用和工具执行结果
- 将 AI 上下文绑定到当前 SSH 终端
- 在 UI 中切换模型和能力组合

### 远程文件工作流

- 浏览远程文件树
- 打开并查看文件内容
- 上传和下载文件
- 使用偏 SFTP 风格的文件视图

### 面向运维人员的桌面体验

- Activity Bar + Sidebar + Workbench 布局
- Light / Dark / Midnight 主题
- 后端地址和外观设置
- 面向远程仓库工作流的 Git 面板

## 典型使用场景

- 把终端、文件和 AI 辅助排障统一放到一个桌面工作台中
- 在保持直接终端控制权的前提下，让 AI 帮助操作 Linux 服务器
- 在同一个界面中查看日志、配置文件和远程仓库
- 把 AI 对话绑定到你当前正在操作的服务器会话
- 为 DevOps、SRE、后端或平台团队搭建内部运维桌面工具

## 相比传统 SSH 工具的优势

传统 SSH 工具通常停留在“终端连接 + 文件传输”层面，而 StackSSH Client 围绕更完整的运维流程设计。

- AI 对话内建在工作台中，而不是依赖外部工具切换
- 终端、文件、Git、知识上下文统一在一个界面中
- 终端会话可以和服务端 Agent 执行链路直接关联
- 后端地址、模型、能力组合都可以在 UI 中管理
- 它面向的是“运维上下文”，而不只是“开一个 shell 窗口”

## 在 StackSSH 中的角色

StackSSH 采用前后端分层架构：

- `stackssh-client` 负责交互与可视化
- `stackssh-server` 负责 SSH 执行、凭据、安全策略和 AI 编排

这种方式让客户端更专注体验，同时把敏感执行留在服务端边界内。

## 技术栈

- Tauri 2
- React 19
- TypeScript
- Vite 7
- Zustand
- Tailwind CSS
- Monaco Editor / xterm.js 相关工具链

## 主要目录

```text
src/
  api/         HTTP 与流式接口封装
  components/  工作台 UI 组件
  stores/      Zustand 状态管理
  views/       页面级容器
  types/       共享 TypeScript 类型
src-tauri/     Tauri 侧 Rust 宿主
```

## 关键模块

- 登录与认证流程
- SSH 连接管理
- 终端面板
- AI 对话面板
- 文件浏览与 SFTP 工作区
- Git 面板
- 主题与设置系统
- Knowledge / MCP / Skills 能力管理

## 快速启动

### 环境要求

- Node.js 18+
- npm
- 用于 Tauri 构建的 Rust 工具链
- 一个已启动的 `stackssh-server`

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

辅助脚本：

- Windows：`docs/dev-ops/start-dev.bat`
- macOS / Linux：`docs/dev-ops/start-dev.sh`

### 仅前端调试

```bash
npm run dev
```

### 生产构建

```bash
npm run tauri build
```

## 后端依赖

默认情况下客户端依赖：

- `stackssh-server`
- 默认后端地址：`http://localhost:8091`

开发模式下，Vite 可以代理 API 和 WebSocket 请求到后端。

## 推荐搭配

建议和下面的后端仓库一起使用：

- [`stackssh-server`](https://github.com/BlueBloodFire/stackssh-server)

两者共同组成完整的 StackSSH 产品：

- `stackssh-client`：UI、桌面交互、工作台
- `stackssh-server`：SSH 执行、Agent 运行时、安全边界

## License

当前仓库还没有发布明确的许可证。如果你计划对外分发或复用，请先补充正式 License。
