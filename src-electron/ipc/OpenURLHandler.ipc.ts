import { shell } from 'electron'

import { IPCEmitHandler } from '../shared/IPCHandler'

/**
 * Handles the 'open-url' event.
 */
class OpenURLHandler implements IPCEmitHandler<'open-url'> {
	event = 'open-url' as const

	/**
	 * Opens `url` in the default browser.
	 */
	handler(url: string) {
		shell.openExternal(url)
	}
}

export const openURLHandler = new OpenURLHandler()
