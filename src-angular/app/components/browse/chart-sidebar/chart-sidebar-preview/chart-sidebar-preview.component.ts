import { ChangeDetectorRef, Component, ElementRef, HostBinding, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { FormControl } from '@angular/forms'

import { chain, sortBy } from 'lodash'
import { SngHeader, SngStream } from 'parse-sng'
import { from, switchMap, throttleTime } from 'rxjs'
import { Difficulty, getInstrumentType, Instrument, parseChartFile } from 'scan-chart'
import { SettingsService } from 'src-angular/app/core/services/settings.service.js'
import { ChartData } from 'src-shared/interfaces/search.interface.js'
import { getBasename, getExtension, hasAudioExtension, hasAudioName, hasChartExtension, hasChartName, hasVideoName, msToRoughTime } from 'src-shared/UtilFunctions.js'

import { ChartPreview } from './render.js'

@Component({
	selector: 'app-chart-sidebar-preview',
	templateUrl: './chart-sidebar-preview.component.html',
	standalone: false,
})
export class ChartSidebarPreviewComponent implements OnInit, OnDestroy {
	@HostBinding('class.h-full') height = true
	@ViewChild('previewDiv') previewDiv: ElementRef<HTMLDivElement>

	@Input() selectedChart: ChartData
	@Input() instrument: Instrument
	@Input() difficulty: Difficulty

	private lastVolume: number | null = null
	public isMuted = true
	public playState: 'paused' | 'loading' | 'play' | 'end' = 'paused'
	public chartPreview: ChartPreview | null = null

	private parsedChart: ReturnType<typeof parseChartFile> | null = null
	private textures: Awaited<ReturnType<typeof ChartPreview.loadTextures>> | null = null
	private audioFiles: Uint8Array[] | null = null

	public seekBar: FormControl<number>
	public volumeBar: FormControl<number>
	public timestampUpdateInterval: ReturnType<typeof setInterval>
	public timestampText: string = ''

	constructor(
		private cdr: ChangeDetectorRef,
		private settingsService: SettingsService,
	) { }
	ngOnInit() {
		this.seekBar = new FormControl<number>(
			(100 * (this.selectedChart.preview_start_time ?? 0)) / (this.selectedChart.song_length ?? 5 * 60 * 1000),
			{ nonNullable: true },
		)
		this.seekBar.valueChanges
			.pipe(
				throttleTime(30, undefined, { leading: true, trailing: true }),
				switchMap(progress =>
					from(
						(async () => {
							this.playState = 'loading'
							await this.chartPreview?.seek(progress / 100)
							this.playState = 'paused'
						})(),
					),
				),
			)
			.subscribe()
		this.volumeBar = new FormControl<number>(this.settingsService.volume, { nonNullable: true })
		this.isMuted = this.settingsService.volume === 0
		this.volumeBar.valueChanges.subscribe(volume => {
			this.settingsService.volume = volume
			if (this.chartPreview) {
				this.chartPreview.volume = volume / 100
			}
		})
	}

	ngOnDestroy() {
		this.endChartPreview()
	}

	private spaceListener = (event: KeyboardEvent) => {
		if (event.code === 'Space') {
			this.togglePlaying()
			event.preventDefault()
		}
	}
	async resetChartPreview(checkInstrumentType = true) {
		if (this.parsedChart && this.textures && this.audioFiles) {
			this.playState = 'loading'
			if (checkInstrumentType && this.chartPreview?.instrumentType !== getInstrumentType(this.instrument)) {
				this.textures = await ChartPreview.loadTextures(getInstrumentType(this.instrument))
			}
			this.chartPreview?.dispose()
			this.chartPreview = await ChartPreview.create(
				this.parsedChart,
				this.textures,
				this.audioFiles,
				this.instrument,
				this.difficulty,
				this.selectedChart.delay ?? (this.selectedChart.chart_offset ?? 0) * 1000,
				this.selectedChart.song_length ?? 5 * 60 * 1000,
				this.previewDiv.nativeElement,
			)
			this.chartPreview.on('progress', percentComplete => {
				this.seekBar.setValue(percentComplete * 100, { emitEvent: false })
			})
			this.chartPreview.on('end', async () => {
				await this.chartPreview!.togglePaused()
				this.playState = 'end'
				this.cdr.detectChanges()
			})
			this.chartPreview.volume = this.volumeBar.value / 100
			await this.chartPreview.seek(this.seekBar.value / 100)
			document.addEventListener('keydown', this.spaceListener)
			this.timestampUpdateInterval = setInterval(
				() => (this.timestampText = msToRoughTime(this.chartPreview!.chartCurrentTimeMs) + ' / ' + msToRoughTime(this.chartPreview!.chartEndTimeMs)),
				100,
			)
			this.playState = 'paused'
		}
	}
	endChartPreview() {
		this.previewDiv.nativeElement.firstChild?.remove()
		this.chartPreview?.dispose()
		this.chartPreview = null
		this.parsedChart = null
		this.textures = null
		this.audioFiles = null
		this.playState = 'paused'
		this.seekBar.setValue(0, { emitEvent: false })
		document.removeEventListener('keydown', this.spaceListener)
		clearInterval(this.timestampUpdateInterval)
	}

	async togglePlaying() {
		if (this.playState === 'end') {
			await this.chartPreview!.seek(0)
			this.playState = 'paused'
		}
		if (this.playState === 'paused') {
			this.playState = 'loading'
			if (this.chartPreview === null) {
				const filesPromise = getChartFiles(this.selectedChart)
				const [parsedChart, textures, audioFiles] = await Promise.all([
					(async () => {
						const { chartData, format } = findChartData(await filesPromise)
						const iniChartModifiers = Object.assign(
							{
								song_length: 0,
								hopo_frequency: 0,
								eighthnote_hopo: false,
								multiplier_note: 0,
								sustain_cutoff_threshold: -1,
								chord_snap_threshold: 0,
								five_lane_drums: false,
								pro_drums: false,
							},
							this.selectedChart,
						)
						return parseChartFile(chartData, format, iniChartModifiers)
					})(),
					ChartPreview.loadTextures(getInstrumentType(this.instrument)),
					(async () => findAudioData(await filesPromise))(),
				])
				this.parsedChart = parsedChart
				this.textures = textures
				this.audioFiles = audioFiles
				await this.resetChartPreview(false)
			}
			await this.chartPreview!.togglePaused()
			this.playState = 'play'
		} else if (this.playState === 'play') {
			this.playState = 'loading'
			await this.chartPreview!.togglePaused()
			this.playState = 'paused'
		}
	}

	toggleMuted() {
		this.isMuted = !this.isMuted
		if (this.isMuted) {
			this.lastVolume = this.volumeBar.value
			this.volumeBar.setValue(0)
		} else {
			this.volumeBar.setValue(this.lastVolume ?? 50)
		}
	}
}

async function getChartFiles(chartData: ChartData) {
	const chartUrl = `https://files.enchor.us/${chartData.md5 + (chartData.hasVideoBackground ? '_novideo' : '')}.sng`
	const sngResponse = await fetch(chartUrl, { mode: 'cors', referrerPolicy: 'no-referrer' })
	if (!sngResponse.ok) {
		throw new Error('Failed to fetch the .sng file')
	}

	const sngStream = new SngStream(sngResponse.body!, { generateSongIni: true })

	let header: SngHeader
	sngStream.on('header', h => (header = h))
	const isFileTruncated = (fileName: string) => {
		const MAX_FILE_MIB = 2048
		const MAX_FILES_MIB = 5000
		const sortedFiles = sortBy(header.fileMeta, f => f.contentsLen)
		let usedSizeMib = 0
		for (const sortedFile of sortedFiles) {
			usedSizeMib += Number(sortedFile.contentsLen / BigInt(1024) / BigInt(1024))
			if (sortedFile.filename === fileName) {
				return usedSizeMib > MAX_FILES_MIB || sortedFile.contentsLen / BigInt(1024) / BigInt(1024) >= MAX_FILE_MIB
			}
		}
	}

	const files: { fileName: string; data: Uint8Array }[] = []

	return await new Promise<{ fileName: string; data: Uint8Array }[]>((resolve, reject) => {
		sngStream.on('file', async (fileName: string, fileStream: ReadableStream<Uint8Array>, nextFile) => {
			const matchingFileMeta = header.fileMeta.find(f => f.filename === fileName)
			if (hasVideoName(fileName) || isFileTruncated(fileName) || !matchingFileMeta) {
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
				let readCount = 0
				const reader = fileStream.getReader()
				// eslint-disable-next-line no-constant-condition
				while (true) {
					const result = await reader.read()
					if (result.done) {
						break
					}
					readCount++
					if (readCount % 5 === 0) {
						await new Promise<void>(resolve => setTimeout(resolve, 2))
					} // Allow other processing to happen
					data.set(result.value, offset)
					offset += result.value.length
				}

				files.push({ fileName, data })
			}

			if (nextFile) {
				nextFile()
			} else {
				resolve(files)
			}
		})

		sngStream.on('error', err => reject(err))
		sngStream.start()
	})
}

function findChartData(files: { fileName: string; data: Uint8Array }[]) {
	const chartFiles = chain(files)
		.filter(f => hasChartExtension(f.fileName))
		.orderBy([f => hasChartName(f.fileName), f => getExtension(f.fileName).toLowerCase() === 'mid'], ['desc', 'desc'])
		.value()

	return {
		chartData: chartFiles[0].data,
		format: (getExtension(chartFiles[0].fileName).toLowerCase() === 'mid' ? 'mid' : 'chart') as 'mid' | 'chart',
	}
}
function findAudioData(files: { fileName: string; data: Uint8Array }[]) {
	const audioData: Uint8Array[] = []

	for (const file of files) {
		if (hasAudioExtension(file.fileName)) {
			if (hasAudioName(file.fileName)) {
				if (!['preview', 'crowd'].includes(getBasename(file.fileName).toLowerCase())) {
					audioData.push(file.data)
				}
			}
		}
	}

	return audioData
}
