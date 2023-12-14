import { app } from 'electron'
import { join } from 'path'

// Data paths
export const dataPath = join(app.getPath('userData'), 'bridge_data')
export const libraryPath = join(dataPath, 'library.db')
export const settingsPath = join(dataPath, 'settings.json')
export const tempPath = join(dataPath, 'temp')
export const themesPath = join(dataPath, 'themes')
