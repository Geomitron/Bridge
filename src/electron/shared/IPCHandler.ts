import TestHandler from '../ipc/TestHandler.ipc'
import { TestInput } from './interfaces/test.interface'

/**
 * To add a new IPC listener:
 * 1.) Write input/output interfaces
 * 2.) Add the event to IPCEvents
 * 3.) Write a class that implements IPCHandler
 * 4.) Add the class to getIPCHandlers
 */

export function getIPCHandlers(): IPCHandler<keyof IPCEvents>[] {
  return [
    new TestHandler()
  ]
}

export type IPCEvents = {
  ['test-event-A']: {
    input: TestInput
    output: string
  }
  ['test-event-B']: {
    input: number
    output: number
  }
}

export interface IPCHandler<E extends keyof IPCEvents> {
  event: E
  handler(data: IPCEvents[E]['input']): Promise<IPCEvents[E]['output']> | IPCEvents[E]['output']
}