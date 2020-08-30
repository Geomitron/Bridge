/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/camelcase */
import { dataPath, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from '../../shared/Paths'
import { mainWindow } from '../../main'
import { join } from 'path'
import { readFile, writeFile } from 'jsonfile'
import { google } from 'googleapis'
import { authServer } from './AuthServer'
import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { promisify } from 'util'

const unlink = promisify(fs.unlink)

const TOKEN_PATH = join(dataPath, 'token.json')

export class GoogleAuth {

  private hasTriedTokenFile = false
  private hasAuthenticated = false

  /**
   * Attempts to authenticate the googleapis library using the token stored at `TOKEN_PATH`.
   * @returns `true` if the user is authenticated, and `false` otherwise.
   */
  async attemptToAuthenticate() {
    if (this.hasTriedTokenFile) {
      return this.hasAuthenticated
    }

    const token = await this.getStoredToken()
    if (token != null) {
      // Token has been restored from a previous session
      const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
      oAuth2Client.setCredentials(token)
      google.options({ auth: oAuth2Client })
      this.hasAuthenticated = true
      return true
    } else {
      // Token doesn't exist; user has not authenticated
      this.hasAuthenticated = false
      return false
    }
  }

  async generateAuthToken() {

    if (await this.getStoredToken() != null) { return true }

    if (this.hasTriedTokenFile == false) {
      // Token exists but couldn't be read
      console.log('Auth token exists but could not be loaded. Check file permissions.')
      return false
    }

    const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
    let popupWindow: BrowserWindow
    let gotAuthCode = false

    return new Promise<boolean>(resolve => {
      authServer.on('listening', () => {
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.readonly'],
          redirect_uri: REDIRECT_URI
        })

        popupWindow = new BrowserWindow({
          fullscreenable: false,
          modal: true,
          maximizable: false,
          minimizable: false,
          show: false,
          parent: mainWindow,
          autoHideMenuBar: true,
          center: true,
          thickFrame: true,
          useContentSize: true,
          width: 400,
          
        })
        popupWindow.loadURL(authUrl, { userAgent: 'Chrome' })
        popupWindow.on('ready-to-show', () => popupWindow.show())
        popupWindow.on('closed', () => resolve(gotAuthCode))
      })

      authServer.on('authCode', async (authCode) => {
        const { tokens } = await oAuth2Client.getToken(authCode)
        oAuth2Client.setCredentials(tokens)
        google.options({ auth: oAuth2Client })
        await writeFile(TOKEN_PATH, tokens)
        this.hasTriedTokenFile = false
        gotAuthCode = true
        popupWindow.close()
      })

      authServer.startServer()
    })
  }


  /**
   * @returns the previously stored auth token, or `null` if it doesn't exist or can't be accessed.
   */
  private async getStoredToken() {
    this.hasTriedTokenFile = true
    try {
      return await readFile(TOKEN_PATH)
    } catch (err) {
      if (err && err.code && err.code != 'ENOENT') {
        // Failed to access the file; next attempt should try again
        this.hasTriedTokenFile = false
      }

      return null
    }
  }

  /**
   * removes the previously stored auth token.
   */
  async deleteStoredToken() {
    this.hasTriedTokenFile = false
    this.hasAuthenticated = false
    try {
      await unlink(TOKEN_PATH)
    } catch (err) {
      console.log('Failed to delete token.')
      return
    }
  }
}

export const googleAuth = new GoogleAuth()