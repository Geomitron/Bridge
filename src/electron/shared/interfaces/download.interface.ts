/**
 * Contains the data required to start downloading a single chart
 */
export interface NewDownload {
  versionID: number
  avTagName: string
  artist: string
  charter: string
  links: { [type: string]: string }
}

/**
 * Represents the download progress of a single chart
 */
export interface Download {
  versionID: number
  title: string
  header: string
  description: string
  percent: number
}