import { get, post } from './request'

const BASE = '/api/v1/ssh/file'

export interface SshFileEntryDTO {
  name: string
  path: string
  directory: boolean
  size: number | null
  modifiedAt: number | null
}

export interface SshFileTreeResponseDTO {
  rootPath: string
  homePath: string
  currentPath: string
  parentPath: string | null
  items: SshFileEntryDTO[]
}

export interface SshFileContentResponseDTO {
  path: string
  name: string
  charset: string
  size: number
  binary: boolean
  truncated: boolean
  content: string
}

export function getFileTree(connectionId: string, path?: string) {
  return get<SshFileTreeResponseDTO>(`${BASE}/tree`, { connectionId, path: path ?? '' })
}

export function getFileContent(connectionId: string, path: string) {
  return get<SshFileContentResponseDTO>(`${BASE}/content`, { connectionId, path })
}

export function createFile(connectionId: string, path: string) {
  return post<void>(`${BASE}/create-file`, undefined, { connectionId, path })
}

export function createDirectory(connectionId: string, path: string) {
  return post<void>(`${BASE}/create-directory`, undefined, { connectionId, path })
}

export function renameFile(connectionId: string, oldPath: string, newPath: string) {
  return post<void>(`${BASE}/rename`, undefined, { connectionId, oldPath, newPath })
}

export function deleteFile(connectionId: string, path: string) {
  return post<void>(`${BASE}/delete`, undefined, { connectionId, path })
}

export function saveFileContent(connectionId: string, path: string, content: string, useSudo?: boolean) {
  return post<void>(`${BASE}/save-content`, { content }, { connectionId, path, sudo: useSudo ? 'true' : 'false' })
}
