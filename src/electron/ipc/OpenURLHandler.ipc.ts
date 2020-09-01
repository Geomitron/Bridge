import { IPCEmitHandler } from '../shared/IPCHandler'
import { shell } from 'electron'

/**
 * Handles the 'open-url' event.
 */
class OpenURLHandler implements IPCEmitHandler<'open-url'> {
  event: 'open-url' = 'open-url'

  /**
   * Opens `url` in the default browser.
   */
  handler(url: string) {
    shell.openExternal(url)
  }
}

export const openURLHandler = new OpenURLHandler()