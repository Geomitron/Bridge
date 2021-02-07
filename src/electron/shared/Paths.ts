import { join } from 'path'
import { app } from 'electron'

// Data paths
export const dataPath = join(app.getPath('userData'), 'bridge_data')
export const libraryPath = join(dataPath, 'library.db')
export const settingsPath = join(dataPath, 'settings.json')
export const tempPath = join(dataPath, 'temp')
export const themesPath = join(dataPath, 'themes')

// URL
export const serverURL = 'bridge-db.net'

// OAuth callback server
export const SERVER_PORT = 42813
export const REDIRECT_BASE = `http://127.0.0.1:${SERVER_PORT}`
export const REDIRECT_PATH = `/oauth2callback`
export const REDIRECT_URI = `${REDIRECT_BASE}${REDIRECT_PATH}`