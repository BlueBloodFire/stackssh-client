/**
 * SSH 终端操作 API
 */
import { get, post } from './request'

const BASE = '/api/v1/ssh/terminal'

// ===== 类型定义 =====

/** 打开终端请求 */
export interface TerminalOpenPayload {
  connectionId: string
  cols?: number
  rows?: number
}

/** 打开终端响应 */
export interface TerminalOpenResponse {
  sessionId: string
  connectionId: string
  initialOutput: string
}

/** 执行命令请求（整行模式，兼容旧逻辑） */
export interface TerminalExecPayload {
  sessionId: string
  command: string
}

/** 执行命令响应 */
export interface TerminalExecResponse {
  output: string
}

/** 终端写入请求（原始输入，逐字节发送到 Shell） */
export interface TerminalWritePayload {
  sessionId: string
  input: string
}

/** 终端读取响应（Shell 缓冲输出） */
export interface TerminalReadResponse {
  output: string
}

/** 调整终端大小请求 */
export interface TerminalResizePayload {
  sessionId: string
  cols: number
  rows: number
}

// ===== API 方法 =====

/** 打开终端会话 */
export function openTerminal(payload: TerminalOpenPayload) {
  return post<TerminalOpenResponse>(`${BASE}/open`, payload)
}

/** 执行命令（整行模式） */
export function execCommand(payload: TerminalExecPayload) {
  return post<TerminalExecResponse>(`${BASE}/exec`, payload)
}

/** 写入原始输入到终端（逐字节模式，Shell 自身处理 echo） */
export function writeInput(payload: TerminalWritePayload) {
  return post<void>(`${BASE}/write`, payload)
}

/** 读取终端缓冲输出（轮询模式） */
export function readOutput(sessionId: string) {
  return get<TerminalReadResponse>(`${BASE}/read`, { sessionId })
}

/** 调整终端大小 */
export function resizeTerminal(payload: TerminalResizePayload) {
  return post<void>(`${BASE}/resize`, payload)
}

/** 关闭终端会话 */
export function closeTerminal(sessionId: string) {
  return post<void>(`${BASE}/close`, undefined, { sessionId })
}

/** 危险命令检测结果 */
export interface CommandCheckResult {
  dangerous: boolean
  warning?: string
  matchedPattern?: string
}

/** 检测命令是否危险 */
export function checkCommand(command: string) {
  return post<CommandCheckResult>(`${BASE}/check-command`, { command })
}

// ===== 终端录制 API =====

const RECORDING_BASE = `${BASE}/recording`

export interface TerminalRecordingEvent {
  offsetMs: number
  data: string  // base64 编码的终端输出
}

export interface TerminalRecording {
  id: number
  recordingId: string
  connectionId: string
  sessionId: string
  cols: number
  rows: number
  status: number  // 0=录制中 1=已完成 2=已中断
  startedAt: string
  endedAt?: string
  durationMs?: number
  events?: TerminalRecordingEvent[]
}

/** 开始录制 */
export function startRecording(sessionId: string, connectionId: string) {
  return post<string>(`${RECORDING_BASE}/start`, { sessionId, connectionId })
}

/** 停止录制 */
export function stopRecording(sessionId: string, recordingId: string) {
  return post<void>(`${RECORDING_BASE}/stop`, { sessionId, recordingId })
}

/** 查询连接的录制列表 */
export function listRecordings(connectionId: string) {
  return get<TerminalRecording[]>(`${RECORDING_BASE}/list`, { connectionId })
}

/** 获取录制回放数据 */
export function getRecordingPlayback(recordingId: string) {
  return get<TerminalRecording>(`${RECORDING_BASE}/playback/${recordingId}`)
}
