import Bottleneck from 'bottleneck'
import dayjs from 'dayjs'
import { shell } from 'electron'
import { createReadStream } from 'fs'
import pkg from 'fs-extra'
import _ from 'lodash'
import { SngHeader, SngStream } from 'parse-sng'
import { scanChartFolder, ScannedChart } from 'scan-chart'
import { Readable } from 'stream'
import { inspect } from 'util'

import { appearsToBeChartFolder, getExtension, hasAlbumName, hasChartExtension, hasIniExtension, hasSngExtension } from '../../../src-shared/UtilFunctions.js'
import { hasVideoExtension } from '../../ElectronUtilFunctions.js'
import { emitIpcEvent } from '../../main.js'
import { getSettings } from '../SettingsHandler.ipc.js'
import { getChartIssues, getIssuesXLSX } from './ExcelBuilder.js'

const { readdir, readFile, writeFile } = pkg
export async function scanIssues() {
	const settings = await getSettings()
	if (!settings.issueScanPath || !settings.spreadsheetOutputPath) {
		emitIpcEvent('updateIssueScan', {
			status: 'error',
			message: 'Scan path or output path were not properly defined.',
		})
		return
	}

	try {
		const chartFolders = await getChartFolders(settings.issueScanPath)

		const limiter = new Bottleneck({ maxConcurrent: 20 }) // Ensures memory use stays bounded

		const charts: { chart: ScannedChart; path: string }[] = []
		for (const chartFolder of chartFolders) {
			limiter.schedule(async () => {
				const isSng = chartFolder.files.length === 1 && hasSngExtension(chartFolder.files[0])
				const files = isSng ? await getFilesFromSng([chartFolder.path, chartFolder.files[0]].join('/')) : await getFilesFromFolder(chartFolder)

				const result: { chart: ScannedChart; path: string } = {
					chart: scanChartFolder(files),
					path: chartFolder.path,
				}
				charts.push(result)
				emitIpcEvent('updateIssueScan', { status: 'progress', message: `${charts.length}/${chartFolders.length} scanned...` })
			})
		}

		await new Promise<void>((resolve, reject) => {
			limiter.on('error', err => {
				reject(err)
				limiter.stop()
			})

			limiter.on('idle', async () => {
				const issues = getChartIssues(charts)
				const xlsx = await getIssuesXLSX(issues)
				const outputPath = [settings.spreadsheetOutputPath, `chart_issues_${dayjs().format('YYYY.MM.DD_HH.mm.ss')}.xlsx`].join('/')
				await writeFile(outputPath, new Uint8Array(xlsx))
				await new Promise<void>(resolve => setTimeout(resolve, 500)) // Delay for OS file processing
				await shell.openPath(outputPath)
				emitIpcEvent('updateIssueScan', {
					status: 'done',
					message: `${issues.length} issues found in ${charts.length} charts. Spreadsheet saved to ${outputPath}`,
				})
				resolve()
			})
		})
	} catch (err) {
		emitIpcEvent('updateIssueScan', { status: 'error', message: inspect(err) })
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
		emitIpcEvent('updateIssueScan', { status: 'progress', message: `${chartFolders} charts found...` })
	}

	return chartFolders
}

async function getFilesFromSng(sngPath: string) {
	const sngStream = new SngStream(Readable.toWeb(createReadStream(sngPath)) as ReadableStream<Uint8Array>, { generateSongIni: true })

	let header: SngHeader
	sngStream.on('header', h => header = h)
	const isFileTruncated = (fileName: string) => {
		const MAX_FILE_MIB = 2048
		const MAX_FILES_MIB = 5000
		const sortedFiles = _.sortBy(header.fileMeta, f => f.contentsLen)
		let usedSizeMib = 0
		for (const sortedFile of sortedFiles) {
			usedSizeMib += Number(sortedFile.contentsLen / BigInt(1024) / BigInt(1024))
			if (sortedFile.filename === fileName) {
				return usedSizeMib > MAX_FILES_MIB || sortedFile.contentsLen / BigInt(1024) / BigInt(1024) >= MAX_FILE_MIB
			}
		}
	}


	const files: { fileName: string; data: Uint8Array }[] = []

	await new Promise<void>((resolve, reject) => {
		sngStream.on('file', async (fileName, fileStream, nextFile) => {
			const matchingFileMeta = header.fileMeta.find(f => f.filename === fileName)
			if (hasVideoExtension(fileName) || isFileTruncated(fileName) || !matchingFileMeta) {
				const reader = fileStream.getReader()
				// eslint-disable-next-line no-constant-condition
				while (true) {
					const result = await reader.read()
					if (result.done) {
						break
					}
				}
			} else {
				const data = new Uint8Array(Number(matchingFileMeta.contentsLen))
				let offset = 0
				const reader = fileStream.getReader()
				// eslint-disable-next-line no-constant-condition
				while (true) {
					const result = await reader.read()
					if (result.done) {
						break
					}
					data.set(result.value, offset)
					offset += result.value.length
				}

				files.push({ fileName, data })
			}

			if (nextFile) {
				nextFile()
			} else {
				resolve()
			}
		})

		sngStream.on('error', error => reject(error))

		sngStream.start()
	})

	return files
}

async function getFilesFromFolder(chartFolder: { path: string; files: string[] }): Promise<{ fileName: string; data: Uint8Array }[]> {
	const files: { fileName: string; data: Uint8Array }[] = []

	for (const fileName of chartFolder.files) {
		if (hasChartExtension(fileName) || hasIniExtension(fileName) || hasAlbumName(fileName)) {
			files.push({ fileName, data: await readFile(chartFolder.path + '/' + fileName) })
		} else {
			files.push({ fileName, data: new Uint8Array() })
		}
	}

	return files
}
