import { IPCInvokeHandler } from '../../shared/IPCHandler'
import { googleAuth } from './GoogleAuth'

/**
 * Handles the 'google-login' event.
 */
class GoogleLoginHandler implements IPCInvokeHandler<'google-login'> {
  event: 'google-login' = 'google-login'

  /**
   * @returns `true` if the user has been authenticated.
   */
  async handler() {
    return new Promise<boolean>(resolve => {
      googleAuth.generateAuthToken().then((isLoggedIn) => resolve(isLoggedIn))
    })
  }
}

export const googleLoginHandler = new GoogleLoginHandler()

/**
 * Handles the 'google-login' event.
 */
class GoogleLogoutHandler implements IPCInvokeHandler<'google-logout'> {
  event: 'google-logout' = 'google-logout'

  /**
   * @returns `true` if the user has been authenticated.
   */
  async handler() {
    return new Promise<undefined>(resolve => {
      googleAuth.deleteStoredToken().then(() => resolve(undefined))
    })
  }
}

export const googleLogoutHandler = new GoogleLogoutHandler()

/**
 * Handles the 'get-auth-status' event.
 */
class GetAuthStatusHandler implements IPCInvokeHandler<'get-auth-status'> {
  event: 'get-auth-status' = 'get-auth-status'

  /**
   * @returns `true` if the user is authenticated with Google.
   */
  handler() {
    return new Promise<boolean>(resolve => {
      googleAuth.attemptToAuthenticate().then(isAuthenticated => resolve(isAuthenticated))
    })
  }
}

export const getAuthStatusHandler = new GetAuthStatusHandler()