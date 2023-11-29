import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { cloneDeep } from 'lodash'
import { mkdirp } from 'mkdirp'
import { inspect } from 'util'

import { dataPath, settingsPath, tempPath, themesPath } from '../../src-shared/Paths'
import { defaultSettings, Settings } from '../../src-shared/Settings'
import { devLog } from '../ElectronUtilFunctions'

export let settings = readSettings()

function readSettings() {
	try {
		const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<Settings>
		return Object.assign(cloneDeep(defaultSettings), settings)
	} catch (err) {
		if (err?.code === 'ENOENT') {
			saveSettings(cloneDeep(defaultSettings))
		} else {
			devLog('Failed to load settings. Default settings will be used.\n' + inspect(err))
		}
		return cloneDeep(defaultSettings)
	}
}

/**
 * Updates Bridge's settings object to `newSettings` and saves them to Bridge's data directories.
 */
export async function setSettings(newSettings: Settings) {
	settings = newSettings
	await saveSettings(newSettings)
}

/**
 * @returns the current settings object, or default settings if they couldn't be loaded.
 */
export async function getSettings() {
	return settings
}

/**
 * Saves `settings` to Bridge's data directories. If settings are not provided, default settings are used.
 */
async function saveSettings(settings: Settings) {
	try {
		// Create data directories if they don't exist
		for (const path of [dataPath, tempPath, themesPath]) {
			await mkdirp(path)
		}

		await writeFile(settingsPath, JSON.stringify(settings, undefined, 2), 'utf8')
	} catch (err) {
		devLog('Failed to save settings.\n' + inspect(err))
	}
}
