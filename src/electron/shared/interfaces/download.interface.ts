import { DriveChart } from './songDetails.interface'

/**
 * Represents a user's request to interact with the download system.
 */
export interface Download {
  action: 'add' | 'retry' | 'continue' | 'cancel'
  versionID: number
  data?: NewDownload // Should be defined if action == 'add'
}

/**
 * Contains the data required to start downloading a single chart.
 */
export interface NewDownload {
  avTagName: string
  artist: string
  charter: string
  driveData: DriveChart
}

/**
 * Represents the download progress of a single chart.
 */
export interface DownloadProgress {
  versionID: number
  title: string
  header: string
  description: string
  percent: number
  type: ProgressType
}

export type ProgressType = 'good' | 'warning' | 'error' | 'cancel' | 'done' | 'fastUpdate'
// export function downloadSorter(p1: DownloadProgress, p2: DownloadProgress) {
//   return 0
//   // return p1 - p2 // negative if p1 < p2
// }