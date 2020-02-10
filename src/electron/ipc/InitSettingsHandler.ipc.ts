import { exists as _exists, mkdir as _mkdir, readFile as _readFile, writeFile as _writeFile } from 'fs'
import { dataPath, tempPath, themesPath, settingsPath } from '../shared/Paths'
import { promisify } from 'util'
import { IPCInvokeHandler } from '../shared/IPCHandler'
import { defaultSettings, Settings } from '../shared/Settings'

const exists = promisify(_exists)
const mkdir = promisify(_mkdir)
const readFile = promisify(_readFile)
const writeFile = promisify(_writeFile)

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
        const newSettings = JSON.stringify(defaultSettings, undefined, 2)
        await writeFile(settingsPath, newSettings, 'utf8')
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