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
  name: string
  chartName: string
  artist: string
  album: string
  genre: string
  year: string
  songDataIncorrect: boolean
  driveData: DriveChart & { inChartPack: boolean }
  md5: string
  lastModified: string
  icon: string
  charters: string
  charterIDs: string
  tags: string | null
  songLength: number
  diff_band: number
  diff_guitar: number
  diff_bass: number
  diff_rhythm: number
  diff_drums: number
  diff_keys: number
  diff_guitarghl: number
  diff_bassghl: number
  chartData: ChartData
}

export interface DriveChart {
  source: DriveSource
  isArchive: boolean
  downloadPath: string
  filesHash: string
  folderName: string
  folderID: string
  files: DriveFile[]
}

export interface DriveSource {
  isSetlistSource: boolean
  isDriveFileSource?: boolean
  setlistIcon?: string
  sourceUserIDs: number[]
  sourceName: string
  sourceDriveID: string
  proxyLink?: string
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

export interface ChartData {
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
    [instrument in Instrument]: {
      [difficulty in ChartedDifficulty]: number
    }
  }
  /** number of seconds */
  length: number
  /** number of seconds */
  effectiveLength: number
}

export type Instrument = 'guitar' | 'bass' | 'rhythm' | 'keys' | 'drums' | 'guitarghl' | 'bassghl' | 'vocals'
export type ChartedDifficulty = 'x' | 'h' | 'm' | 'e'

export function getInstrumentIcon(instrument: Instrument) {
  switch(instrument) {
    case 'guitar': return 'guitar.png'
    case 'bass': return 'bass.png'
    case 'rhythm': return 'guitar.png' // TODO: get unique icon
    case 'keys': return 'keys.png'
    case 'drums': return 'drums.svg'
    case 'guitarghl': return 'guitarghl.png'
    case 'bassghl': return 'bassghl.png'
    case 'vocals': return 'guitar.png' // TODO: get unique icon
  }
}