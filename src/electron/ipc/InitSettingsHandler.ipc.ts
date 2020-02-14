import { exists as _exists, mkdir as _mkdir, readFile as _readFile } from 'fs'
import { dataPath, tempPath, themesPath, settingsPath } from '../shared/Paths'
import { promisify } from 'util'
import { IPCInvokeHandler } from '../shared/IPCHandler'
import { defaultSettings, Settings } from '../shared/Settings'
import SaveSettingsHandler from './SaveSettingsHandler.ipc'

const exists = promisify(_exists)
const mkdir = promisify(_mkdir)
const readFile = promisify(_readFile)

export default class InitSettingsHandler implements IPCInvokeHandler<'init-settings'> {
  event: 'init-settings' = 'init-settings'

  private static settings: Settings
  static async getSettings() {
    if (this.settings == undefined) {
      this.settings = await InitSettingsHandler.initSettings()
    }

    return this.settings
  }

  async handler() {
    return InitSettingsHandler.getSettings()
  }

  private static async initSettings(): Promise<Settings> {
    try {
      // Create data directories if they don't exists
      for (const path of [dataPath, tempPath, themesPath]) {
        if (!await exists(path)) {
          await mkdir(path)
        }
      }

      // Read/create settings
      if (await exists(settingsPath)) {
        return JSON.parse(await readFile(settingsPath, 'utf8'))
      } else {
        await SaveSettingsHandler.saveSettings(defaultSettings)
        return defaultSettings
      }
    } catch (e) {
      console.error('Failed to initialize settings!')
      console.error('Several actions (including downloading) will unexpectedly fail')
      console.error(e)
      return defaultSettings
    }
  }
}