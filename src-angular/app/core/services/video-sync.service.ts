/**
 * Bridge Video Sync Module - Angular Service
 */

import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import {
	YouTubeSearchResult,
	VideoDownloadProgress,
	VideoDownloadOptions,
	ChartVideoMatch,
} from '../../../../src-shared/interfaces/video-sync.interface.js'

@Injectable({
	providedIn: 'root',
})
export class VideoSyncService {
	private downloadProgressSubject = new BehaviorSubject<VideoDownloadProgress | null>(null)
	private isDownloadingSubject = new BehaviorSubject<boolean>(false)
	private toolsAvailableSubject = new BehaviorSubject<{ ytDlp: boolean; ffmpeg: boolean } | null>(null)

	readonly downloadProgress$ = this.downloadProgressSubject.asObservable()
	readonly isDownloading$ = this.isDownloadingSubject.asObservable()
	readonly toolsAvailable$ = this.toolsAvailableSubject.asObservable()

	constructor() {
		this.setupIpcListeners()
		this.checkTools()
	}

	private setupIpcListeners(): void {
		window.electron.on.videoDownloadProgress((progress: VideoDownloadProgress) => {
			this.downloadProgressSubject.next(progress)

			if (progress.phase === 'complete' || progress.phase === 'error') {
				this.isDownloadingSubject.next(false)
			} else if (progress.phase === 'downloading' || progress.phase === 'converting') {
				this.isDownloadingSubject.next(true)
			}
		})
	}

	async checkTools(): Promise<{ ytDlp: boolean; ffmpeg: boolean }> {
		try {
			const result = await window.electron.invoke.videoCheckTools()
			this.toolsAvailableSubject.next(result)
			return result
		} catch (err) {
			console.error('Failed to check tools:', err)
			const result = { ytDlp: false, ffmpeg: false }
			this.toolsAvailableSubject.next(result)
			return result
		}
	}

	async searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
		try {
			return await window.electron.invoke.videoSearchYouTube(query)
		} catch (err) {
			console.error('YouTube search failed:', err)
			throw err
		}
	}

	async getVideoInfo(videoId: string): Promise<YouTubeSearchResult | null> {
		try {
			return await window.electron.invoke.videoGetInfo(videoId)
		} catch (err) {
			console.error('Failed to get video info:', err)
			return null
		}
	}

	async downloadVideo(options: VideoDownloadOptions): Promise<string> {
		this.isDownloadingSubject.next(true)
		this.downloadProgressSubject.next({
			phase: 'downloading',
			percent: 0,
			message: 'Starting download...',
			videoId: options.videoId,
			chartId: options.chartId,
		})

		try {
			const result = await window.electron.invoke.videoDownload(options)
			return result
		} catch (err) {
			this.downloadProgressSubject.next({
				phase: 'error',
				percent: 0,
				message: `Error: ${err}`,
				videoId: options.videoId,
				chartId: options.chartId,
			})
			throw err
		} finally {
			this.isDownloadingSubject.next(false)
		}
	}

	async cancelDownload(videoId: string): Promise<boolean> {
		try {
			const result = await window.electron.invoke.videoCancelDownload(videoId)
			if (result) {
				this.isDownloadingSubject.next(false)
				this.downloadProgressSubject.next(null)
			}
			return result
		} catch (err) {
			console.error('Failed to cancel download:', err)
			return false
		}
	}

	async getChartsMissingVideo(limit: number = 10000): Promise<ChartVideoMatch[]> {
		try {
			const charts = await window.electron.invoke.videoGetChartsMissingVideo(limit)
			return charts.map(chart => ({
				chartId: chart.id,
				chartName: chart.name,
				chartArtist: chart.artist,
				chartPath: chart.path,
				songLength: chart.songLength,
				suggestedQuery: chart.suggestedQuery,
			}))
		} catch (err) {
			console.error('Failed to get charts missing video:', err)
			return []
		}
	}

	async buildSearchQuery(chartId: number): Promise<string> {
		try {
			return await window.electron.invoke.videoBuildSearchQuery(chartId)
		} catch (err) {
			console.error('Failed to build search query:', err)
			return ''
		}
	}

	/**
	 * Search for videos across different sources
	 */
	async searchVideos(query: string, source: string): Promise<YouTubeSearchResult[]> {
		try {
			return await window.electron.invoke.videoSearch([query, source])
		} catch (err) {
			console.error(`${source} search failed:`, err)
			throw err
		}
	}

	/**
	 * Download video from any URL supported by yt-dlp
	 */
	async downloadFromUrl(options: { chartId: number; url: string; outputPath: string }): Promise<string> {
		this.isDownloadingSubject.next(true)
		this.downloadProgressSubject.next({
			phase: 'downloading',
			percent: 0,
			message: 'Starting download from URL...',
			chartId: options.chartId,
		})

		try {
			const result = await window.electron.invoke.videoDownloadFromUrl(options)
			return result
		} catch (err) {
			this.downloadProgressSubject.next({
				phase: 'error',
				percent: 0,
				message: `Error: ${err}`,
				chartId: options.chartId,
			})
			throw err
		}
	}

	/**
	 * Open file dialog to select a local video file
	 */
	async selectVideoFile(): Promise<string | null> {
		try {
			return await window.electron.invoke.videoSelectLocalFile()
		} catch (err) {
			console.error('Failed to select video file:', err)
			throw err
		}
	}

	/**
	 * Import a local video file into the chart folder
	 */
	async importLocalVideo(options: { chartId: number; sourcePath: string; outputPath: string }): Promise<string> {
		this.isDownloadingSubject.next(true)
		this.downloadProgressSubject.next({
			phase: 'converting',
			percent: 0,
			message: 'Importing local video...',
			chartId: options.chartId,
		})

		try {
			const result = await window.electron.invoke.videoImportLocal(options)
			this.downloadProgressSubject.next({
				phase: 'complete',
				percent: 100,
				message: 'Import complete',
				chartId: options.chartId,
			})
			return result
		} catch (err) {
			this.downloadProgressSubject.next({
				phase: 'error',
				percent: 0,
				message: `Import error: ${err}`,
				chartId: options.chartId,
			})
			throw err
		} finally {
			this.isDownloadingSubject.next(false)
		}
	}

	get toolsAvailable(): { ytDlp: boolean; ffmpeg: boolean } | null {
		return this.toolsAvailableSubject.value
	}

	get isDownloading(): boolean {
		return this.isDownloadingSubject.value
	}

	get downloadProgress(): VideoDownloadProgress | null {
		return this.downloadProgressSubject.value
	}
}
