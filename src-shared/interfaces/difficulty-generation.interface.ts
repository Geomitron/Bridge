import { Difficulty, Instrument } from 'scan-chart'

export interface DifficultyGeneration {
	action: 'add' | 'remove' | 'retry'
	chartFolderPath: string
	instrument: Instrument
	difficulty: Difficulty
}

/**
 * Represents the download progress of a single chart.
 */
export interface DifficultyGenerationProgress {
	chartFolderPath: string
	instrument: Instrument
	difficulty: Difficulty
	header: string
	body: string
	percent: number | null
	type: DifficultyGenerationProgressType
	/** If `body` contains a filepath that can be clicked */
	isPath: boolean
	/** If the download should not appear in the total download progress */
	stale?: boolean
}

export type DifficultyGenerationProgressType = 'good' | 'error' | 'done' | 'cancel'
