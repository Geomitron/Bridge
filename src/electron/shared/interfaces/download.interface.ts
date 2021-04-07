import { DriveChart } from './songDetails.interface'

/**
 * Represents a user's request to interact with the download system.
 */
export interface Download {
  action: 'add' | 'retry' | 'cancel'
  versionID: number
  data?: NewDownload // Should be defined if action == 'add'
}

/**
 * Contains the data required to start downloading a single chart.
 */
export interface NewDownload {
  chartName: string
  artist: string
  charter: string
  driveData: DriveChart & { inChartPack: boolean }
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
  isLink: boolean
}

export type ProgressType = 'good' | 'error' | 'cancel' | 'done' | 'fastUpdate'