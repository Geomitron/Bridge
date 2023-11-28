import * as fs from 'fs'
import { promisify } from 'util'

import { IPCEmitHandler, IPCInvokeHandler } from '../shared/IPCHandler'
import { dataPath, settingsPath, tempPath, themesPath } from '../shared/Paths'
import { defaultSettings, Settings } from '../shared/Settings'

const exists = promisify(fs.exists)
const mkdir = promisify(fs.mkdir)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)

let settings: Settings

/**
 * Handles the 'set-settings' event.
 */
class SetSettingsHandler implements IPCEmitHandler<'set-settings'> {
	event = 'set-settings' as const

	/**
	 * Updates Bridge's settings object to `newSettings` and saves them to Bridge's data directories.
	 */
	handler(newSettings: Settings) {
		settings = newSettings
		SetSettingsHandler.saveSettings(settings)
	}

	/**
	 * Saves `settings` to Bridge's data directories.
	 */
	static async saveSettings(settings: Settings) {
		const settingsJSON = JSON.stringify(settings, undefined, 2)
		await writeFile(settingsPath, settingsJSON, 'utf8')
	}
}

/**
 * Handles the 'get-settings' event.
 */
class GetSettingsHandler implements IPCInvokeHandler<'get-settings'> {
	event = 'get-settings' as const

	/**
	 * @returns the current settings oject, or default settings if they couldn't be loaded.
	 */
	handler() {
		return this.getSettings()
	}

	/**
	 * @returns the current settings oject, or default settings if they couldn't be loaded.
	 */
	getSettings() {
		if (settings == undefined) {
			return defaultSettings
		} else {
			return settings
		}
	}

	/**
	 * If data directories don't exist, creates them and saves the default settings.
	 * Otherwise, loads user settings from data directories.
	 * If this process fails, default settings are used.
	 */
	async initSettings() {
		try {
			// Create data directories if they don't exists
			for (const path of [dataPath, tempPath, themesPath]) {
				if (!await exists(path)) {
					await mkdir(path)
				}
			}

			// Read/create settings
			if (await exists(settingsPath)) {
				settings = JSON.parse(await readFile(settingsPath, 'utf8'))
				settings = Object.assign(JSON.parse(JSON.stringify(defaultSettings)), settings)
			} else {
				await SetSettingsHandler.saveSettings(defaultSettings)
				settings = defaultSettings
			}
		} catch (e) {
			console.error('Failed to initialize settings! Default settings will be used.')
			console.error(e)
			settings = defaultSettings
		}
	}
}

export const getSettingsHandler = new GetSettingsHandler()
export const setSettingsHandler = new SetSettingsHandler()
export function getSettings() { return getSettingsHandler.getSettings() }
