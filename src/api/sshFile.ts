import { get } from './request'

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
