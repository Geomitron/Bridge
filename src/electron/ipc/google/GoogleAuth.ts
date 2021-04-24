/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/camelcase */
import { dataPath, REDIRECT_URI } from '../../shared/Paths'
import { mainWindow } from '../../main'
import { join } from 'path'
import { readFile, writeFile } from 'jsonfile'
import { google } from 'googleapis'
import { Credentials } from 'googleapis/node_modules/google-auth-library/build/src/auth/credentials'
import { OAuth2Client } from 'googleapis-common/node_modules/google-auth-library/build/src/auth/oauth2client'
import * as needle from 'needle'
import { authServer } from './AuthServer'
import { BrowserWindow } from 'electron'
import { serverURL } from '../../shared/Paths'
import * as fs from 'fs'
import { promisify } from 'util'
import { devLog } from '../../shared/ElectronUtilFunctions'
import { serializeError } from 'serialize-error'

const unlink = promisify(fs.unlink)

const TOKEN_PATH = join(dataPath, 'token.json')

export class GoogleAuth {

  private hasAuthenticated = false

  private oAuth2Client: OAuth2Client = null
  private token: Credentials = null

  /**
   * Attempts to authenticate the googleapis library using the token stored at `TOKEN_PATH`.
   * @returns `true` if the user is authenticated, and `false` otherwise.
   */
  async attemptToAuthenticate() {

    if (this.hasAuthenticated) {
      return true
    }

    // Get client info from server
    if (!await this.getOAuth2Client()) {
      return false
    }

    // Get stored token
    if (!await this.getStoredToken()) {
      return false
    }

    // Token has been restored from a previous session
    this.authenticateWithToken()
    return true
  }

  /**
   * Uses OAuth2 to generate a token that can be used to authenticate download requests.
   * Involves displaying a popup window to the user.
   * @returns true if the auth token was generated, and false otherwise.
   */
  async generateAuthToken() {

    if (this.hasAuthenticated) {
      return true
    }

    // Get client info from server
    if (!await this.getOAuth2Client()) {
      return false
    }

    let popupWindow: BrowserWindow

    return new Promise<boolean>(resolve => {
      authServer.on('listening', () => {
        const authUrl = this.oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          // This scope is too broad, but is the only one that will actually download files for some dumb reason.
          // If you want this fixed, please upvote/star my issue on the Google bug tracker so they will fix it faster:
          // https://issuetracker.google.com/issues/168687448
          scope: ['https://www.googleapis.com/auth/drive.readonly'],
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
          width: 400
        })
        popupWindow.loadURL(authUrl, { userAgent: 'Chrome' })
        popupWindow.on('ready-to-show', () => popupWindow.show())
        popupWindow.on('closed', () => resolve(this.hasAuthenticated))
      })

      authServer.on('authCode', async (authCode) => {
        this.token = (await this.oAuth2Client.getToken(authCode)).tokens
        writeFile(TOKEN_PATH, this.token).catch(err => devLog('Got token, but failed to write it to TOKEN_PATH:', serializeError(err)))

        this.authenticateWithToken()

        popupWindow.close()
      })

      authServer.startServer()
    })
  }

  /**
   * Use this.token as the credentials for this.oAuth2Client, and make the google library use this authentication.
   * Assumes these have already been defined correctly.
   */
  private authenticateWithToken() {
    this.oAuth2Client.setCredentials(this.token)
    google.options({ auth: this.oAuth2Client })
    this.hasAuthenticated = true
  }

  /**
   * Attempts to get Bridge's client info from the server.
   * @returns true if this.clientID and this.clientSecret have been set, and false if that failed.
   */
  private async getOAuth2Client() {
    if (this.oAuth2Client != null) {
      return true
    } else {
      return new Promise<boolean>(resolve => {
        needle.request(
          'get',
          serverURL + `/api/data/client`, null, (err, response) => {
            if (err) {
              devLog('Could not authenticate because client info could not be retrieved from the server:', serializeError(err))
              resolve(false)
            } else {
              this.oAuth2Client = new google.auth.OAuth2(response.body.CLIENT_ID, response.body.CLIENT_SECRET, REDIRECT_URI)
              resolve(true)
            }
          })
      })
    }
  }

  /**
   * Attempts to retrieve a previously stored auth token at `TOKEN_PATH`.
   * Note: will not try again if this.token === undefined.
   * @returns true if this.token has been set, and false if that failed or the token didn't exist.
   */
  private async getStoredToken() {
    if (this.token === undefined) {
      return false // undefined means no token file was found
    } else if (this.token !== null) {
      return true
    } else {
      try {
        this.token = await readFile(TOKEN_PATH)
        return true
      } catch (err) {
        if (err?.code && err?.code != 'ENOENT') {
          this.token = null // File exists but could not be accessed; next attempt should try again
        } else {
          this.token = undefined
        }

        return false
      }
    }
  }

  /**
   * Removes a previously stored auth token from `TOKEN_PATH`.
   */
  async deleteStoredToken() {
    this.token = undefined
    this.hasAuthenticated = false
    try {
      await unlink(TOKEN_PATH)
    } catch (err) {
      devLog('Failed to delete token:', serializeError(err))
      return
    }
  }
}

export const googleAuth = new GoogleAuth()