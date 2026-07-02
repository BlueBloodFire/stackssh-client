# StackSSH Client

[中文文档](./README.zh-CN.md)

`stackssh-client` is the desktop workbench of StackSSH.

It provides an IDE-style interface for SSH operations, AI-assisted conversations, remote file management, and terminal workflows, while delegating actual SSH execution and AI orchestration to `stackssh-server`.

## What It Is

StackSSH Client is not a traditional SSH GUI.

It is an **AI-native remote operations workspace** with:

- a terminal-centered workbench
- a right-side AI task panel
- remote file and SFTP views
- Git-oriented workflow support
- a themeable Tauri desktop experience

## Core Experience

### Terminal Workbench

- Open and manage SSH terminal sessions
- Multi-tab terminal workflow
- Command history assistance
- Terminal search
- Dangerous command confirmation flow
- WebSocket-based terminal interaction

### AI Task Center

- Chat with an operations-oriented AI agent
- Stream multi-step ReAct responses
- Observe tool calls and tool results
- Bind AI context to the active SSH terminal
- Switch models and capability combinations from the UI

### Remote File Workflow

- Browse remote file trees
- Open and inspect file contents
- Upload and download files
- Work with SFTP-oriented file views

### Operator-Friendly Desktop UX

- Activity bar + sidebar + workbench layout
- Light / dark / midnight themes
- Backend endpoint and appearance settings
- Git-oriented panel for remote repository workflows

## Typical Use Cases

- Use one desktop workbench for terminal, file, and AI-assisted troubleshooting
- Operate Linux servers with AI help while still keeping direct terminal control
- Explore logs, configuration files, and repositories from the same interface
- Connect AI conversations to the exact server session you are working on
- Build an internal operations desktop for DevOps, SRE, backend, or platform teams

## Why It Is Better Than a Traditional SSH Tool

Traditional SSH tools usually stop at terminal access plus some file transfer capability. StackSSH Client is designed around a broader workflow.

- AI conversation is built into the workbench instead of being an external side tool
- Terminal, files, Git, and knowledge are placed in one unified interface
- Terminal sessions can be tied to server-side agent execution
- Backend endpoint, models, and capability combinations can be managed from the UI
- It is built for operational context, not only for opening a shell window

## Product Role in StackSSH

StackSSH uses a split architecture:

- `stackssh-client` handles interaction and visualization
- `stackssh-server` owns SSH execution, credentials, policy, and AI orchestration

This keeps the client focused on user experience while sensitive execution stays on the server boundary.

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Vite 7
- Zustand
- Tailwind CSS
- Monaco Editor / xterm.js tooling

## Main Areas

```text
src/
  api/         HTTP and streaming API wrappers
  components/  Workbench UI components
  stores/      Zustand state stores
  views/       Page-level containers
  types/       Shared TypeScript types
src-tauri/     Tauri-side Rust host
```

## Key Functional Modules

- Login and auth flow
- SSH connection management
- Terminal panel
- AI conversation panel
- File explorer and SFTP workspace
- Git panel
- Theme and settings system
- Knowledge / MCP / Skills capability management

## Quick Start

### Requirements

- Node.js 18+
- npm
- Rust toolchain for Tauri build
- a running `stackssh-server`

### Install

```bash
npm install
```

### Development

```bash
npm run tauri dev
```

Helper scripts:

- Windows: `docs/dev-ops/start-dev.bat`
- macOS / Linux: `docs/dev-ops/start-dev.sh`

### Frontend-only Debug

```bash
npm run dev
```

### Production Build

```bash
npm run tauri build
```

## Backend Dependency

By default the client expects:

- `stackssh-server`
- backend URL: `http://localhost:8091`

In development, Vite can proxy API and WebSocket traffic to the backend.

## Recommended Pairing

This repository is the desktop UI layer. Use it together with:

- [`stackssh-server`](https://github.com/BlueBloodFire/stackssh-server)

Together they form the full StackSSH product:

- `stackssh-client`: UI, desktop interaction, workbench
- `stackssh-server`: SSH execution, agent runtime, security boundary

## License

Licensed under the Apache License 2.0. See the [LICENSE](./LICENSE) file for details.
