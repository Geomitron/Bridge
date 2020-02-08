import SearchHandler from '../ipc/SearchHandler.ipc'
import { SongSearch, SongResult } from './interfaces/search.interface'
import { VersionResult } from './interfaces/songDetails.interface'
import SongDetailsHandler from '../ipc/SongDetailsHandler.ipc'

/**
 * To add a new IPC listener:
 * 1.) Write input/output interfaces
 * 2.) Add the event to IPCEvents
 * 3.) Write a class that implements IPCHandler
 * 4.) Add the class to getIPCHandlers
 */

export function getIPCHandlers(): IPCHandler<keyof IPCEvents>[] {
  return [
    new SearchHandler(),
    new SongDetailsHandler()
  ]
}

export type IPCEvents = {
  ['song-search']: {
    input: SongSearch
    output: SongResult[]
  }
  ['song-details']: {
    input: SongResult['id']
    output: VersionResult[]
  }
}

export interface IPCHandler<E extends keyof IPCEvents> {
  event: E
  handler(data: IPCEvents[E]['input']): Promise<IPCEvents[E]['output']> | IPCEvents[E]['output']
}