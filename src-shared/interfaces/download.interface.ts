
/**
 * Represents a user's request to interact with the download system.
 */
export interface Download {
	action: 'add' | 'remove' | 'retry'
	md5: string
	// Should be defined if action === 'add'
	hasVideoBackground?: boolean
	chart?: { name: string; artist: string; album: string; genre: string; year: string; charter: string }
}

/**
 * Represents the download progress of a single chart.
 */
export interface DownloadProgress {
	md5: string
	chart: { name: string; artist: string; album: string; genre: string; year: string; charter: string }
	header: string
	body: string
	percent: number | null
	type: ProgressType
	/** If `body` contains a filepath that can be clicked */
	isPath: boolean
	/** If the download should not appear in the total download progress */
	stale?: boolean
}

export type ProgressType = 'good' | 'error' | 'done' | 'cancel'
