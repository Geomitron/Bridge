import { IPCEmitHandler } from '../shared/IPCHandler'
import { shell } from 'electron'

export default class OpenFolderHandler implements IPCEmitHandler<'open-folder'> {
  event: 'open-folder' = 'open-folder'

  async handler(filepath: string) {
    shell.showItemInFolder(filepath)
  }
}