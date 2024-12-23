import { readFileSync } from 'fs'
import { ensureDir, outputFile } from 'fs-extra'
import _ from 'lodash'
import { inspect } from 'util'

import { dataPath, settingsPath, tempPath, themesPath } from '../../src-shared/Paths.js'
import { defaultSettings, Settings } from '../../src-shared/Settings.js'
import { mainWindow } from '../main.js'

console.log(settingsPath)
export let settings = readSettings()

function readSettings() {
	try {
		const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<Settings>
		return Object.assign(_.cloneDeep(defaultSettings), settings)
	} catch (err) {
		if (err?.code === 'ENOENT') {
			saveSettings(_.cloneDeep(defaultSettings))
		} else {
			console.error('Failed to load settings. Default settings will be used.\n' + inspect(err))
		}
		return _.cloneDeep(defaultSettings)
	}
}

/**
 * Updates Bridge's settings object to `newSettings` and saves them to Bridge's data directories.
 */
export async function setSettings(newSettings: Settings) {
	if (settings.zoomFactor !== newSettings.zoomFactor) {
		mainWindow.webContents.setZoomFactor(newSettings.zoomFactor)
	}
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
		await Promise.all([
			// Create data directories if they don't exist
			ensureDir(dataPath),
			ensureDir(tempPath),
			ensureDir(themesPath),
			outputFile(settingsPath, JSON.stringify(settings, undefined, 2), { encoding: 'utf8' }),
		])
	} catch (err) {
		console.error('Failed to save settings.\n' + inspect(err))
	}
}
