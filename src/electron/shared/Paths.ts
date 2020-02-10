import * as path from 'path'
import { app } from 'electron'

// Data paths
export const dataPath = path.join(app.getPath('userData'), 'bridge_data')
export const libraryPath = path.join(dataPath, 'library.db')
export const settingsPath = path.join(dataPath, 'settings.json')
export const tempPath = path.join(dataPath, 'temp')
export const themesPath = path.join(dataPath, 'themes')