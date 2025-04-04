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

		const charts: { chart: ParsedChart; path: string }[] = []
		for (const chartFolder of chartFolders) {
			limiter.schedule(async () => {
				const isSng = chartFolder.files.length === 1 && hasSngExtension(chartFolder.files[0])

				if (isSng) {
					console.info('SNG files are not supported yet.', chartFolder)
					return
				}

				const files = await getChartFilesFromFolder(chartFolder)

				if (files.length === 0) {
					return
				}

				if (files.length > 1) {
					console.info('Multiple charts found in folder.', chartFolder)
					return
				}

				const file = files[0]

				const result: { chart: ParsedChart; path: string } = {
					chart: parseChartFile(file.data, file.fileName.endsWith('.chart') ? 'chart' : 'mid'),
					path: chartFolder.path,
				}
				charts.push(result)
				emitIpcEvent('updateChartsDifficultyGeneration', { status: 'progress', message: `${charts.length}/${chartFolders.length} scanned...` })
			})
		}


		await new Promise<void>((resolve, reject) => {
			limiter.on('error', err => {
				reject(err)
				limiter.stop()
			})

			limiter.on('idle', async () => {
				let chartsWithMissingDifficulties = 0

				for (const { chart, path: chartPath } of charts) {

					const missingDifficulties = getChartMissingDifficultiesByInstrument({ chart })

					if (missingDifficulties.size === 0) {
						continue
					}

					chartsWithMissingDifficulties++

					for (const [instrument, difficulties] of missingDifficulties) {
						for (const difficulty of difficulties) {
							generateDifficulty({
								action: 'add',
								chartFolderPath: chartPath,
								instrument,
								difficulty,
							})
						}
					}

				}

				emitIpcEvent('updateChartsDifficultyGeneration', {
					status: 'done',
					message: `${chartsWithMissingDifficulties} charts with missing difficulties added to queue.`,
				})
				resolve()
			})
		})

	} catch (err) {
		emitIpcEvent('updateChartsDifficultyGeneration', { status: 'error', message: inspect(err) })
	}
}

/**
 * @returns valid chart folders in `path` and all its subdirectories.
 */
async function getChartFolders(path: string) {
	const chartFolders: { path: string; files: string[] }[] = []

	const entries = await readdir(path, { withFileTypes: true })

	const subfolders = _.chain(entries)
		.filter(entry => entry.isDirectory() && entry.name !== '__MACOSX') // Apple should follow the principle of least astonishment (smh)
		.map(folder => getChartFolders([path, folder.name].join('/')))
		.value()

	chartFolders.push(..._.flatMap(await Promise.all(subfolders)))

	const sngFiles = entries.filter(entry => !entry.isDirectory() && hasSngExtension(entry.name))
	chartFolders.push(...sngFiles.map(sf => ({ path, files: [sf.name] })))

	if (
		subfolders.length === 0 && // Charts won't contain other charts
		appearsToBeChartFolder(entries.map(entry => getExtension(entry.name)))
	) {
		chartFolders.push({
			path,
			files: entries.filter(entry => !entry.isDirectory()).map(entry => entry.name),
		})
		emitIpcEvent('updateChartsDifficultyGeneration', { status: 'progress', message: `${chartFolders.length} charts found...` })
	}

	return chartFolders
}

async function getChartFilesFromFolder(chartFolder: { path: string; files: string[] }): Promise<{ fileName: string; data: Uint8Array }[]> {
	const files: { fileName: string; data: Uint8Array }[] = []

	for (const fileName of chartFolder.files) {
		if (hasChartExtension(fileName)) {
			files.push({ fileName, data: await readFile(chartFolder.path + '/' + fileName) })
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
