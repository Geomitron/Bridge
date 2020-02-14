import { writeFile as _writeFile } from 'fs'
import { IPCEmitHandler } from '../shared/IPCHandler'
import { Settings } from '../shared/Settings'
import { promisify } from 'util'
import { settingsPath } from '../shared/Paths'

const writeFile = promisify(_writeFile)

export default class SaveSettingsHandler implements IPCEmitHandler<'update-settings'> {
  event: 'update-settings' = 'update-settings'

  handler(settings: Settings) {
    SaveSettingsHandler.saveSettings(settings)
  }

  static async saveSettings(settings: Settings) {
    const settingsJSON = JSON.stringify(settings, undefined, 2)
    await writeFile(settingsPath, settingsJSON, 'utf8')
  }
}