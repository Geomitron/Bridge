import { SongSearch, SongResult } from './interfaces/search.interface'
import { VersionResult, AlbumArtResult } from './interfaces/songDetails.interface'
import SearchHandler from '../ipc/SearchHandler.ipc'
import SongDetailsHandler from '../ipc/SongDetailsHandler.ipc'
import AlbumArtHandler from '../ipc/AlbumArtHandler.ipc'
import { Download, NewDownload, DownloadProgress } from './interfaces/download.interface'
import { DownloadHandler } from '../ipc/download/DownloadHandler'
import { Settings } from './Settings'
import InitSettingsHandler from '../ipc/InitSettingsHandler.ipc'

/**
 * To add a new IPC listener:
 * 1.) Write input/output interfaces
 * 2.) Add the event to IPCEvents
 * 3.) Write a class that implements IPCHandler
 * 4.) Add the class to getIPCHandlers
 */

export function getIPCInvokeHandlers(): IPCInvokeHandler<keyof IPCInvokeEvents>[] {
  return [
    new InitSettingsHandler(),
    new SearchHandler(),
    new SongDetailsHandler(),
    new AlbumArtHandler()
  ]
}

export type IPCInvokeEvents = {
  'init-settings': {
    input: undefined
    output: Settings
  }
  'song-search': {
    input: SongSearch
    output: SongResult[]
  }
  'album-art': {
    input: SongResult['id']
    output: AlbumArtResult
  }
  'song-details': {
    input: SongResult['id']
    output: VersionResult[]
  }
}

export interface IPCInvokeHandler<E extends keyof IPCInvokeEvents> {
  event: E
  handler(data: IPCInvokeEvents[E]['input']): Promise<IPCInvokeEvents[E]['output']> | IPCInvokeEvents[E]['output']
}

export function getIPCEmitHandlers(): IPCEmitHandler<keyof IPCEmitEvents>[]{
  return [
    new DownloadHandler()
  ]
}

export type IPCEmitEvents = {
  'download': Download
  'download-updated': DownloadProgress
}

export interface IPCEmitHandler<E extends keyof IPCEmitEvents> {
  event: E
  handler(data: IPCEmitEvents[E]): void
}