<p align="center">
  <img src="./src-angular/assets/images/bridge-animation.gif"/>
</p>
<h3 align="center">A rhythm game chart searching and downloading tool.</h3>
<img align="center" src="./src-angular/assets/images/example.png"/>
<hr>

**Bridge** is a desktop application that allows you to search for and download charts that can be played in  games like Clone Hero, YARG, etc...

This is the desktop version of [Chorus Encore](https://www.enchor.us/).

## Setup

Head over to the [Releases](https://github.com/Geomitron/Bridge/releases) page to download the install wizard. (Windows 10/11, Mac, and Linux versions are available)

## Features

- ✅ Find all charts that can be found on Chorus Encore.
- ✅ Download any chart directly into your chart library as a chart folder or `.sng` file.
- ✅ Multi-select songs to add to the download queue.
- ✅ Cancel and retry downloads.
- ✅ In-app update checking and downloading.
- ✅ A variety of themes.
- ✅ Advanced song search.

### What's new in v3.0.0

v3.0.0

- Update to Angular 18
- Update to Electron 31 (and CommonJS to ESM)
- Add Chart Preview
- Add Drum Type dropdown when the "drums" instrument is selected
- Add Min/Max Year to advanced search
- Add Track Hash to advanced search
- Add "Download Video Backgrounds" setting
- Add zoom function
- Add support for custom themes (https://daisyui.com/theme-generator/)
- Add ability to configure the columns in the search result table
- Add customization for the structure of the downloaded chart folders
- Add Flatpak builds for Linux
- Fixed a variety of issues causing some charts to not download
- Improved support for web-based keyboard shortcuts
- Updated and improved detected chart issues
- Various UI improvements

### Development

Built using Node.js, Angular, and Electron.

Learn how to install Node.js [here](https://nodejs.dev/en/download/)

After installing Node.js and cloning the repository, install dependencies and run development with:

```
$ npm install -g pnpm
$ pnpm install && pnpm start
```

### Socials

To discuss the project and make suggestions, please join the [Discord](https://discord.gg/cqaUXGm)

To help me pay for the server costs, please check out the [Patreon](https://www.patreon.com/ChorusEncore701)
