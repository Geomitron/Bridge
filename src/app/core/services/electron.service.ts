import { Injectable } from '@angular/core'

// If you import a module but never use any of the imported values other than as TypeScript types,
// the resulting javascript file will look as if you never imported the module at all.
import * as electron from 'electron'
import { IPCInvokeEvents, IPCEmitEvents } from '../../../electron/shared/IPCHandler'

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  electron: typeof electron

  get isElectron() {
    return !!(window && window.process && window.process.type)
  }

  constructor() {
    if (this.isElectron) {
      this.electron = window.require('electron')
      this.receiveIPC('log', results => results.forEach(result => console.log(result)))
    }
  }

  get currentWindow() {
    return this.electron.remote.getCurrentWindow()
  }

  /**
   * Calls an async function in the main process.
   * @param event The name of the IPC event to invoke.
   * @param data The data object to send across IPC.
   * @returns A promise that resolves to the output data.
   */
  async invoke<E extends keyof IPCInvokeEvents>(event: E, data: IPCInvokeEvents[E]['input']) {
    return this.electron.ipcRenderer.invoke(event, data) as Promise<IPCInvokeEvents[E]['output']>
  }

  /**
   * Sends an IPC message to the main process.
   * @param event The name of the IPC event to send.
   * @param data The data object to send across IPC.
   */
  sendIPC<E extends keyof IPCEmitEvents>(event: E, data: IPCEmitEvents[E]) {
    this.electron.ipcRenderer.send(event, data)
  }

  /**
   * Receives an IPC message from the main process.
   * @param event The name of the IPC event to receive.
   * @param callback The data object to receive across IPC.
   */
  receiveIPC<E extends keyof IPCEmitEvents>(event: E, callback: (result: IPCEmitEvents[E]) => void) {
    this.electron.ipcRenderer.on(event, (_event, ...results) => {
      callback(results[0])
    })
  }

  quit() {
    this.electron.remote.app.exit()
  }

  openFolder(filepath: string) {
    this.electron.shell.openPath(filepath)
  }

  showFolder(filepath: string) {
    this.electron.shell.showItemInFolder(filepath)
  }

  showOpenDialog(options: Electron.OpenDialogOptions) {
    return this.electron.remote.dialog.showOpenDialog(this.currentWindow, options)
  }

  get defaultSession() {
    return this.electron.remote.session.defaultSession
  }
}