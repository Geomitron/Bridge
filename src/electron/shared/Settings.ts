/**
 * Represents Bridge's user settings.
 */
export interface Settings {
  rateLimitDelay: number // Number of seconds to wait between each file download from Google servers
  theme: string          // The name of the currently enabled UI theme
  libraryPath: string    // The path to the user's library
}

/**
 * Bridge's default user settings.
 */
export const defaultSettings: Settings = {
  rateLimitDelay: 31,
  theme: 'Default',
  libraryPath: undefined
}