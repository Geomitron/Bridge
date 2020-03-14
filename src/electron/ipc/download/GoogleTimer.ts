import { getSettings } from '../SettingsHandler.ipc'

class GoogleTimer {

  private rateLimitCounter = Infinity
  private onReadyCallback: () => void
  private updateCallback: (remainingTime: number, totalTime: number) => void

  constructor() {
    setInterval(() => {
      this.rateLimitCounter++
      if (this.isReady() && this.onReadyCallback != undefined) {
        this.activateTimerReady()
      } else if (this.updateCallback != undefined) {
        const delay = getSettings().rateLimitDelay
        this.updateCallback(delay - this.rateLimitCounter, delay)
      }
    }, 1000)
  }

  onTimerReady(callback: () => void) {
    this.onReadyCallback = callback
    if (this.isReady()) {
      this.activateTimerReady()
    }
  }

  onTimerUpdate(callback: (remainingTime: number, totalTime: number) => void) {
    this.updateCallback = callback
  }

  removeCallbacks() {
    this.onReadyCallback = undefined
    this.updateCallback = undefined
  }

  private isReady() {
    return this.rateLimitCounter > getSettings().rateLimitDelay
  }

  private activateTimerReady() {
    this.rateLimitCounter = 0
    const onReadyCallback = this.onReadyCallback
    this.removeCallbacks()
    onReadyCallback()
  }
}

export const googleTimer = new GoogleTimer()