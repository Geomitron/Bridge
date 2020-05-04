/**
 * The image data for a song's album art.
 */
export interface AlbumArtResult {
  base64Art: string
}

/**
 * Represents a single chart version.
 */
export interface VersionResult {
  versionID: number
  chartID: number
  songID: number
  latestVersionID: number
  latestSetlistVersionID: number
  icon: string
  driveData: DriveChart & { inChartPack: boolean }
  avTagName: string
  charters: string
  charterIDs: string
  tags: string | null
  lastModified: string
  song_length: number
  diff_band: number
  diff_guitar: number
  diff_rhythm: number
  diff_bass: number
  diff_drums: number
  diff_keys: number
  diff_guitarghl: number
  diff_bassghl: number
  songDataIncorrect: boolean
  year: string
  chartMetadata: ChartMetadata
}

export interface DriveChart {
  source: DriveSource
  isArchive: boolean
  downloadPath: string
  filesHash: string
  files: DriveFile[]
}

export interface DriveSource {
  isSetlistSource: boolean
  setlistIcon?: string
  sourceUserIDs: number[]
  sourceName: string
  sourceDriveID: string
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webContentLink: string
  modifiedTime: string
  md5Checksum: string
  size: string
}

export interface ChartMetadata {
  hasSections: boolean
  hasStarPower: boolean
  hasForced: boolean
  hasTap: boolean
  hasOpen: {
    [instrument: string]: boolean
  }
  hasSoloSections: boolean
  hasLyrics: boolean
  is120: boolean
  hasBrokenNotes: boolean
  noteCounts: {
    [instrument: string]: {
      [difficulty: string]: number
    }
  }
  length: number
  effectiveLength: number
}