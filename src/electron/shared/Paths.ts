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

// Google Project ID (More info on why these are here: https://developers.google.com/identity/protocols/oauth2#installed)
export const CLIENT_ID = '668064259105-vkm77i5lcoo2oumk2eulik7bae8k5agf.apps.googleusercontent.com'
export const CLIENT_SECRET = 'RU69Ubr9CidGcI0Z23Ttn2ZV'
export const SERVER_PORT = 42813
export const REDIRECT_BASE = `http://127.0.0.1:${SERVER_PORT}`
export const REDIRECT_PATH = `/oauth2callback`
export const REDIRECT_URI = `${REDIRECT_BASE}${REDIRECT_PATH}`