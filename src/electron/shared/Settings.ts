export class Settings {

  // Singleton
  private constructor() { }
  private static settings: Settings
  static async getInstance() {
    if (this.settings == undefined) {
      this.settings = new Settings()
    }
    await this.settings.initSettings()
    return this.settings
  }

  songsFolderPath: string

  private async initSettings() {
    // TODO: load settings from settings file or set defaults
  }
}