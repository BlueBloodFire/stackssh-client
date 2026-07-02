# StackSSH Client

`stackssh-client` is the desktop workbench for StackSSH.

It provides an IDE-style interface for SSH operations, AI-assisted conversations, remote file management, and terminal workflows, while delegating actual SSH execution and AI orchestration to `stackssh-server`.

## What It Is

StackSSH Client is not a simple SSH GUI.

It is designed as an **AI-native remote operations workspace** with:

- a terminal-focused workbench
- a right-side AI task panel
- remote file and SFTP views
- Git-oriented workflow support
- themeable desktop UX built with Tauri

## Core Experience

### 1. Terminal Workbench

- Open and manage SSH terminal sessions
- Multi-tab terminal workflow
- Command history assistance
- Terminal search
- Dangerous command confirmation flow
- WebSocket-based terminal interaction

### 2. AI Task Center

- Chat with an operations-focused AI agent
- Stream multi-step ReAct responses
- Observe tool calls and tool results
- Bind AI context to the active SSH terminal
- Switch models and capability combinations from the UI

### 3. Remote File Workflow

- Browse remote file tree
- Open and inspect file contents
- Upload and download files
- Work with SFTP-oriented file views

### 4. Operator-Friendly Desktop UX

- Activity bar + sidebar + workbench layout
- Light / dark / midnight themes
- Settings for backend endpoint and appearance
- Git-oriented panel for remote repository workflows

## Product Role in StackSSH

StackSSH uses a split architecture:

- `stackssh-client` handles the user experience
- `stackssh-server` owns SSH execution, credentials, policy, and AI orchestration

This means the client stays focused on interaction, while sensitive execution stays on the server boundary.

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Vite 7
- Zustand
- Tailwind CSS
- Monaco Editor / xterm.js related tooling

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
- File explorer / SFTP workspace
- Git panel
- Theme and settings system
- Knowledge / MCP / Skills capability management

## Quick Start

### Requirements

- Node.js 18+
- npm
- Rust toolchain for Tauri build
- running `stackssh-server`

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

## Recommended Repo Pairing

This repository is the desktop UI layer. For the backend service, use:

- `stackssh-server`

Together they form the full StackSSH product:

- `stackssh-client`: UI, desktop interaction, workbench
- `stackssh-server`: SSH execution, agent runtime, security boundary

## Intended Audience

StackSSH is aimed at people who spend real time in terminals and remote environments:

- DevOps engineers
- SREs
- backend engineers
- platform engineers
- operators who want AI assistance without giving up terminal control

## License

No license file is currently published in this repository. If you plan to reuse or distribute it, add an explicit license first.
