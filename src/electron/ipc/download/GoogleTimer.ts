import { getSettings } from '../SettingsHandler.ipc'

type EventCallback = {
  'waitProgress': (remainingSeconds: number, totalSeconds: number) => void
  'complete': () => void
}
type Callbacks = { [E in keyof EventCallback]?: EventCallback[E] }

class GoogleTimer {

  private rateLimitCounter = Infinity
  private callbacks: Callbacks = {}

  /**
   * Initializes the timer to call the callbacks if they are defined.
   */
  constructor() {
    setInterval(() => {
      this.rateLimitCounter++
      this.updateCallbacks()
    }, 1000)
  }

  /**
   * Calls `callback` when `event` fires. (no events will be fired after `this.cancelTimer()` is called)
   */
  on<E extends keyof EventCallback>(event: E, callback: EventCallback[E]) {
    this.callbacks[event] = callback
    this.updateCallbacks() // Fire events immediately after the listeners have been added
  }

  /**
   * Check the state of the callbacks and call them if necessary.
   */
  private updateCallbacks() {
    if (this.hasTimerEnded() && this.callbacks.complete != undefined) {
      this.endTimer()
    } else if (this.callbacks.waitProgress != undefined) {
      const delay = getSettings().rateLimitDelay
      this.callbacks.waitProgress(delay - this.rateLimitCounter, delay)
    }
  }

  /**
   * Prevents the callbacks from activating when the timer ends.
   */
  cancelTimer() {
    this.callbacks = {}
  }

  /**
   * Checks if enough time has elapsed since the last timer activation.
   */
  private hasTimerEnded() {
    return this.rateLimitCounter > getSettings().rateLimitDelay
  }

  /**
   * Activates the completion callback and resets the timer.
   */
  private endTimer() {
    this.rateLimitCounter = 0
    const completeCallback = this.callbacks.complete
    this.callbacks = {}
    completeCallback()
  }
}

/**
 * Important: this instance cannot be used by more than one file download at a time.
 */
export const googleTimer = new GoogleTimer()