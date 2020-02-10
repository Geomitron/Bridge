export interface Settings {
  rateLimitDelay: number // Number of seconds to wait between each file download from Google servers
  theme: string          // The name of the currently enabled UI theme
  libraryPath: string    // The path to the user's library
}

export const defaultSettings: Settings = {
  rateLimitDelay: 31,
  theme: 'Default',
  libraryPath: 'C:/Users/bouviejs/Desktop/Bridge Notes/TestLibrary' // TODO: default should be undefined
}