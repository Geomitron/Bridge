import { DifficultyGeneration } from '../../src-shared/interfaces/difficulty-generation.interface.js'
import { GenerateDifficultyQueue } from './generate-difficulty/GenerateDifficultyQueue.js'

const generateDifficultyQueue: GenerateDifficultyQueue = new GenerateDifficultyQueue()

export function generateDifficulty(data: DifficultyGeneration) {
	switch (data.action) {
		case 'add': generateDifficultyQueue.add(data.chartFolderPath, data.instrument, data.difficulty); break
		case 'retry': generateDifficultyQueue.retry(data.chartFolderPath, data.instrument, data.difficulty); break
		case 'remove': generateDifficultyQueue.remove(data.chartFolderPath, data.instrument, data.difficulty); break
	}
}
