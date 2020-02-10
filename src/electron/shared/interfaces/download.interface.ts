/**
 * Represents the download of a single chart
 */
export interface Download {
  versionID: number
  title: string
  header: string
  description: string
  percent: number

  //TODO: figure out how to handle user clicking "retry"
}

export interface NewDownload {
  versionID: number
  avTagName: string
  artist: string
  charter: string
  links: { [type: string]: string }
}


export enum DownloadState {
  wait,      // Waiting for Google rate limit...
  request,   // [song.ini] Sending request...
  warning,   // Warning! [song.ini] has been modified recently and may not match how it was displayed in search results. Download anyway?
  download,  // [song.ini] Downloading: 25%
  extract,   // [archive.zip] Extracting: 44%
  transfer,  // Copying files to library...
  complete   // Complete
}

// Try again button appears after an error: restarts the stage that failed