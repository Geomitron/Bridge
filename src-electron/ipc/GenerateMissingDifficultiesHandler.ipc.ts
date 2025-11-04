import Bottleneck from 'bottleneck'
import pkg from 'fs-extra'
import _ from 'lodash'
import { difficulties, Difficulty, Instrument, parseChartFile } from 'scan-chart'
import { inspect } from 'util'

import { appearsToBeChartFolder, getExtension, hasChartExtension, hasSngExtension } from '../../src-shared/UtilFunctions.js'
import { emitIpcEvent } from '../main.js'
import { generateDifficulty } from './GenerateDifficultyHandler.ipc.js'
import { getSettings } from './SettingsHandler.ipc.js'

const { readdir, readFile } = pkg

type ParsedChart = ReturnType<typeof parseChartFile>

export async function generateMissingDifficulties() {
	const settings = await getSettings()
	if (!settings.chartsDifficultyGenerationPath) {
		emitIpcEvent('updateChartsDifficultyGeneration', { status: 'error', message: 'Charts difficulty generation path was not properly defined.' })
		return
	}

	try {
		const chartFolders = await getChartFolders(settings.chartsDifficultyGenerationPath)
		const limiter = new Bottleneck({ maxConcurrent: 20 }) // Ensures memory use stays bounded
		let chartsWithMissingDifficulties = 0

		await limiter.schedule(async () => {
			return Promise.all(chartFolders.map(async chartFolderPath => {
				const missingDifficulties = await getChartMissingDifficulties({ chartFolderPath })

				if (missingDifficulties.size === 0) {
					return
				}

				if (Array.from(missingDifficulties.values()).every(difficulties => difficulties.includes('expert'))) {
					return
				}

				chartsWithMissingDifficulties++

				for (const [instrument, difficulties] of missingDifficulties) {
					if (difficulties.includes('expert')) {
						continue
					}

					for (const difficulty of difficulties) {
						generateDifficulty({
							action: 'add',
							chartFolderPath,
							instrument,
							difficulty,
						})
					}
				}

			}))
		})

		emitIpcEvent('updateChartsDifficultyGeneration', {
			status: 'done',
			message: `${chartsWithMissingDifficulties} charts with missing difficulties added to queue.`,
		})
	} catch (err) {
		emitIpcEvent('updateChartsDifficultyGeneration', { status: 'error', message: inspect(err) })
	}
}

export async function getChartMissingDifficulties({ chartFolderPath }: { chartFolderPath: string }) {
	const files = await getChartFilesFromFolder({ chartFolderPath })

	if (files.length === 0) {
		throw new Error('No chart files found in folder.')
	}

	if (files.length > 1) {
		throw new Error('Multiple charts found in folder.')
	}

	const file = files[0]

	if (hasSngExtension(file.fileName)) {
		throw new Error('SNG files are not supported yet.')
	}

	const chart = parseChartFile(file.data, file.fileName.endsWith('.chart') ? 'chart' : 'mid')

	return getChartMissingDifficultiesByInstrument({ chart })
}

/**
 * @returns valid chart folders in `path` and all its subdirectories.
 */
async function getChartFolders(path: string) {
	const chartFolders: string[] = []

	const entries = await readdir(path, { withFileTypes: true })

	const subfolders = _.chain(entries)
		.filter(entry => entry.isDirectory() && entry.name !== '__MACOSX') // Apple should follow the principle of least astonishment (smh)
		.map(folder => getChartFolders([path, folder.name].join('/')))
		.value()

	chartFolders.push(..._.flatMap(await Promise.all(subfolders)))

	if (
		subfolders.length === 0 && // Charts won't contain other charts
		appearsToBeChartFolder(entries.map(entry => getExtension(entry.name)))
	) {
		chartFolders.push(path)
	}

	return chartFolders
}

async function getChartFilesFromFolder({ chartFolderPath }: { chartFolderPath: string }): Promise<{ fileName: string; data: Uint8Array }[]> {
	const files: { fileName: string; data: Uint8Array }[] = []

	const chartFolderFiles = await readdir(chartFolderPath)
	for (const fileName of chartFolderFiles) {
		if (hasChartExtension(fileName)) {
			files.push({ fileName, data: await readFile(chartFolderPath + '/' + fileName) })
		}
	}

	return files
}

function getChartMissingDifficultiesByInstrument({ chart }: { chart: ParsedChart }) {
	const missingDifficultiesByInstrument = new Map<Instrument, Difficulty[]>()

	for (const track of chart.trackData) {
		missingDifficultiesByInstrument.set(
			track.instrument,
			(missingDifficultiesByInstrument.get(track.instrument) || difficulties).filter(difficulty => difficulty !== track.difficulty)
		)

		if (missingDifficultiesByInstrument.get(track.instrument)?.length === 0) {
			missingDifficultiesByInstrument.delete(track.instrument)
		}
	}

	return missingDifficultiesByInstrument
}
