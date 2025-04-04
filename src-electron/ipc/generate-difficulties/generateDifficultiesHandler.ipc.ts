import Bottleneck from 'bottleneck'
import { shell } from 'electron'
import pkg from 'fs-extra'
import _ from 'lodash'
import { parseChartFile } from 'scan-chart'
import { inspect } from 'util'

import { appearsToBeChartFolder, getExtension, hasChartExtension, hasSngExtension } from '../../../src-shared/UtilFunctions.js'
import { emitIpcEvent } from '../../main.js'
import { getSettings } from '../SettingsHandler.ipc.js'
import { createChartBackup, generateDifficulty, getChartMissingDifficultiesByInstrument } from './chartDifficultyGenerator.js'
import { mid2Chart } from './mid2chart.js'

const { readdir, readFile, writeFile } = pkg

type ParsedChart = ReturnType<typeof parseChartFile>

export async function generateDifficulties() {
	const settings = await getSettings()
	if (!settings.chartsDifficultyGenerationPath) {
		emitIpcEvent('updateChartsDifficultyGeneration', { status: 'error', message: 'Charts difficulty generation path was not properly defined.' })
		return
	}

	try {
		const chartFolders = await getChartFolders(settings.chartsDifficultyGenerationPath)
		const limiter = new Bottleneck({ maxConcurrent: 20 }) // Ensures memory use stays bounded

		const charts: { chart: ParsedChart; path: string; fileName: string; data: Uint8Array }[] = []
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

				const result: { chart: ParsedChart; path: string; fileName: string; data: Uint8Array } = {
					chart: parseChartFile(file.data, file.fileName.endsWith('.chart') ? 'chart' : 'mid'),
					path: chartFolder.path,
					fileName: file.fileName,
					data: file.data,
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

				for (const { chart, data: chartData, fileName: chartFileName, path: chartPath } of charts) {
					const chartFileType = getExtension(chartFileName)

					const chartFilePath = [chartPath, chartFileName].join('/')
					let newChartContent = chartFileType === 'chart'
						? new TextDecoder('utf-8').decode(chartData)
						: mid2Chart(chartData, {
							placeholderName: chart.metadata.name ?? 'Chart',
							omitEmptySections: true,
						})
					const missingDifficulties = getChartMissingDifficultiesByInstrument({ chart })

					if (missingDifficulties.size === 0) {
						continue
					}

					chartsWithMissingDifficulties++

					for (const [instrument, difficulties] of missingDifficulties) {
						for (const difficulty of difficulties) {
							newChartContent = generateDifficulty({
								content: newChartContent,
								instrument,
								difficulty,
							})
						}
					}

					await createChartBackup({ chartFileType, chartFilePath })

					const outputPath = [chartPath, 'notes.chart'].join('/')
					await writeFile(outputPath, newChartContent)
					await new Promise<void>(resolve => setTimeout(resolve, 500)) // Delay for OS file processing
					await shell.openPath(outputPath)
				}

				emitIpcEvent('updateChartsDifficultyGeneration', {
					status: 'done',
					message: `${chartsWithMissingDifficulties} charts with missing difficulties generated.`,
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
