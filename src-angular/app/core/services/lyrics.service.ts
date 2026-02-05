/**
 * Bridge Lyrics Module - Angular Service
 */

import { Injectable, signal } from '@angular/core'
import { LyricsSearchResult, ChartLyricsMatch, LyricsDownloadProgress } from '../../../../src-shared/interfaces/lyrics.interface.js'

@Injectable({
	providedIn: 'root',
})
export class LyricsService {
	readonly progress = signal<LyricsDownloadProgress | null>(null)

	constructor() {
		this.setupIpcListeners()
	}

	private setupIpcListeners(): void {
		window.electron.on.lyricsProgress((progress: LyricsDownloadProgress) => {
			this.progress.set(progress)
			if (progress.phase === 'complete' || progress.phase === 'error') {
				setTimeout(() => this.progress.set(null), 2000)
			}
		})
	}

	async searchLyrics(artist: string, title: string): Promise<LyricsSearchResult[]> {
		try {
			return await window.electron.invoke.lyricsSearch({ artist, title })
		} catch (err) {
			console.error('Lyrics search failed:', err)
			return []
		}
	}

	async getLyrics(artist: string, title: string, album?: string, duration?: number): Promise<LyricsSearchResult | null> {
		try {
			return await window.electron.invoke.lyricsGet({ artist, title, album, duration })
		} catch (err) {
			console.error('Get lyrics failed:', err)
			return null
		}
	}

	async getLyricsById(id: number): Promise<LyricsSearchResult | null> {
		try {
			return await window.electron.invoke.lyricsGetById(id)
		} catch (err) {
			console.error('Get lyrics by ID failed:', err)
			return null
		}
	}

	async downloadLyrics(
		chartId: number,
		lyricsId: number,
		outputPath: string,
		chartType: 'mid' | 'chart' | 'sng' | null,
		offsetMs: number = 0
	): Promise<{ success: boolean; error?: string }> {
		try {
			return await window.electron.invoke.lyricsDownload({
				chartId,
				lyricsId,
				outputPath,
				chartType,
				offsetMs,
			})
		} catch (err) {
			console.error('Download lyrics failed:', err)
			return { success: false, error: String(err) }
		}
	}

	async getChartsMissingLyrics(limit: number = 10000): Promise<ChartLyricsMatch[]> {
		try {
			return await window.electron.invoke.lyricsGetChartsMissing(limit)
		} catch (err) {
			console.error('Get charts missing lyrics failed:', err)
			return []
		}
	}

	async batchDownloadLyrics(chartIds: number[]): Promise<{ success: number; failed: number; skipped: number }> {
		try {
			return await window.electron.invoke.lyricsBatchDownload(chartIds)
		} catch (err) {
			console.error('Batch download lyrics failed:', err)
			return { success: 0, failed: chartIds.length, skipped: 0 }
		}
	}

	async checkChartLyrics(chartId: number): Promise<{ hasLyrics: boolean }> {
		try {
			return await window.electron.invoke.lyricsCheckChart(chartId)
		} catch (err) {
			console.error('Check chart lyrics failed:', err)
			return { hasLyrics: false }
		}
	}

	async getChartAudioPath(chartPath: string): Promise<{ dataUrl: string; vocalStartMs: number | null; hasVocalsTrack: boolean } | null> {
		try {
			return await window.electron.invoke.lyricsGetAudioPath(chartPath)
		} catch (err) {
			console.error('Get chart audio path failed:', err)
			return null
		}
	}
}
