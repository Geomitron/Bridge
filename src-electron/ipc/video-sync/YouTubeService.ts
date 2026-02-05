/**
 * Bridge Video Sync Module - YouTube Service
 * Handles YouTube search and video downloading via yt-dlp
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { EventEmitter } from 'eventemitter3'
import { YouTubeSearchResult, VideoDownloadProgress, VideoDownloadOptions } from '../../../src-shared/interfaces/video-sync.interface.js'

interface YouTubeServiceEvents {
	downloadProgress: (progress: VideoDownloadProgress) => void
}

class YouTubeService extends EventEmitter<YouTubeServiceEvents> {
	private ytDlpPath: string = 'yt-dlp'  // Assumes yt-dlp is in PATH
	private ffmpegPath: string = 'ffmpeg'  // Assumes ffmpeg is in PATH
	private activeDownloads: Map<string, ChildProcess> = new Map()

	/**
	 * Get the search prefix for different sources
	 */
	private getSearchPrefix(source: string, maxResults: number): string {
		switch (source) {
			case 'youtube':
				return `ytsearch${maxResults}:`
			case 'vimeo':
				return `vmsearch${maxResults}:`
			case 'dailymotion':
				return `dailymotionsearch${maxResults}:`
			case 'archive':
				return `archiveorgsearch${maxResults}:`
			default:
				return `ytsearch${maxResults}:`
		}
	}

	/**
	 * Get thumbnail URL for different sources
	 */
	private getThumbnailUrl(data: any, source: string): string {
		if (data.thumbnail) return data.thumbnail
		if (data.thumbnails && data.thumbnails.length > 0) {
			return data.thumbnails[0].url || data.thumbnails[0]
		}
		// Fallback for YouTube
		if (source === 'youtube' && data.id) {
			return `https://i.ytimg.com/vi/${data.id}/mqdefault.jpg`
		}
		return ''
	}

	/**
	 * Search for videos matching query across different sources
	 */
	async searchVideos(query: string, maxResults: number = 10, source: string = 'youtube'): Promise<YouTubeSearchResult[]> {
		return new Promise((resolve, reject) => {
			const searchPrefix = this.getSearchPrefix(source, maxResults)
			const args = [
				`${searchPrefix}${query}`,
				'--dump-json',
				'--flat-playlist',
				'--no-warnings',
				'--ignore-errors',
			]

			const process = spawn(this.ytDlpPath, args)
			let stdout = ''
			let stderr = ''

			process.stdout.on('data', data => {
				stdout += data.toString()
			})

			process.stderr.on('data', data => {
				stderr += data.toString()
			})

			process.on('close', code => {
				if (code !== 0 && !stdout) {
					reject(new Error(`yt-dlp search failed: ${stderr}`))
					return
				}

				try {
					const results: YouTubeSearchResult[] = []
					const lines = stdout.trim().split('\n').filter(line => line)

					for (const line of lines) {
						try {
							const data = JSON.parse(line)
							if (data.id && data.title) {
								results.push({
									videoId: data.id,
									title: data.title,
									channel: data.channel || data.uploader || 'Unknown',
									duration: this.formatDuration(data.duration),
									durationSeconds: data.duration || 0,
									thumbnailUrl: this.getThumbnailUrl(data, source),
									publishedAt: data.upload_date || '',
									viewCount: data.view_count,
									url: data.url || data.webpage_url,  // Store full URL for non-YouTube sources
								})
							}
						} catch {
							// Skip malformed JSON lines
						}
					}

					resolve(results)
				} catch (err) {
					reject(new Error(`Failed to parse search results: ${err}`))
				}
			})

			process.on('error', err => {
				reject(new Error(`Failed to run yt-dlp: ${err.message}. Make sure yt-dlp is installed.`))
			})
		})
	}

	/**
	 * Get detailed info about a specific video
	 */
	async getVideoInfo(videoId: string): Promise<YouTubeSearchResult | null> {
		return new Promise((resolve, reject) => {
			const args = [
				`https://www.youtube.com/watch?v=${videoId}`,
				'--dump-json',
				'--no-download',
				'--no-warnings',
			]

			const process = spawn(this.ytDlpPath, args)
			let stdout = ''
			let stderr = ''

			process.stdout.on('data', data => {
				stdout += data.toString()
			})

			process.stderr.on('data', data => {
				stderr += data.toString()
			})

			process.on('close', code => {
				if (code !== 0) {
					reject(new Error(`Failed to get video info: ${stderr}`))
					return
				}

				try {
					const data = JSON.parse(stdout)
					resolve({
						videoId: data.id,
						title: data.title,
						channel: data.channel || data.uploader || 'Unknown',
						duration: this.formatDuration(data.duration),
						durationSeconds: data.duration || 0,
						thumbnailUrl: data.thumbnail,
						publishedAt: data.upload_date || '',
						viewCount: data.view_count,
					})
				} catch (err) {
					reject(new Error(`Failed to parse video info: ${err}`))
				}
			})

			process.on('error', err => {
				reject(new Error(`Failed to run yt-dlp: ${err.message}`))
			})
		})
	}

	/**
	 * Download video and convert to chart-compatible format
	 */
	async downloadVideo(options: VideoDownloadOptions): Promise<string> {
		const { videoId, outputPath, targetFormat = 'mp4' } = options
		const outputFile = path.join(outputPath, `video.${targetFormat}`)
		const tempFile = path.join(outputPath, `video_temp.${targetFormat}`)

		// Remove existing video if present
		for (const ext of ['mp4', 'webm', 'avi', 'mkv']) {
			const existing = path.join(outputPath, `video.${ext}`)
			try {
				await fs.promises.unlink(existing)
			} catch {
				// File doesn't exist
			}
		}

		return new Promise((resolve, reject) => {
			this.emit('downloadProgress', {
				phase: 'downloading',
				percent: 0,
				message: 'Starting download...',
				videoId,
				chartId: options.chartId,
			})

			// yt-dlp args for best quality video with audio
			const args = [
				`https://www.youtube.com/watch?v=${videoId}`,
				'-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
				'--merge-output-format', targetFormat,
				'-o', tempFile,
				'--no-playlist',
				'--progress',
				'--newline',
			]

			const process = spawn(this.ytDlpPath, args)
			this.activeDownloads.set(videoId, process)

			let stderrOutput = ''

			process.stdout.on('data', data => {
				const output = data.toString()
				// Parse progress from yt-dlp output
				const percentMatch = output.match(/(\d+\.?\d*)%/)
				if (percentMatch) {
					const percent = parseFloat(percentMatch[1])
					this.emit('downloadProgress', {
						phase: 'downloading',
						percent: Math.min(percent, 99),
						message: `Downloading: ${percent.toFixed(1)}%`,
						videoId,
						chartId: options.chartId,
					})
				}
			})

			process.stderr.on('data', data => {
				const output = data.toString()
				stderrOutput += output

				// yt-dlp sometimes outputs progress to stderr
				const percentMatch = output.match(/(\d+\.?\d*)%/)
				if (percentMatch) {
					const percent = parseFloat(percentMatch[1])
					this.emit('downloadProgress', {
						phase: 'downloading',
						percent: Math.min(percent, 99),
						message: `Downloading: ${percent.toFixed(1)}%`,
						videoId,
						chartId: options.chartId,
					})
				}
			})

			process.on('close', async code => {
				this.activeDownloads.delete(videoId)

				if (code !== 0) {
					// Extract meaningful error from stderr
					let errorMsg = 'Download failed'

					if (stderrOutput.includes('Video unavailable')) {
						errorMsg = 'Video unavailable or region-locked'
					} else if (stderrOutput.includes('Private video')) {
						errorMsg = 'Video is private'
					} else if (stderrOutput.includes('Sign in to confirm your age')) {
						errorMsg = 'Age-restricted video (requires login)'
					} else if (stderrOutput.includes('copyright')) {
						errorMsg = 'Video blocked due to copyright'
					} else if (stderrOutput.includes('HTTP Error 403')) {
						errorMsg = 'Access forbidden (403)'
					} else if (stderrOutput.includes('HTTP Error 404')) {
						errorMsg = 'Video not found (404)'
					} else if (stderrOutput.includes('unable to extract')) {
						errorMsg = 'Unable to extract video data - try updating yt-dlp'
					} else if (stderrOutput.trim()) {
						// Get last meaningful line from stderr
						const lines = stderrOutput.trim().split('\n').filter(l => l.trim() && !l.includes('%'))
						if (lines.length > 0) {
							errorMsg = lines[lines.length - 1].substring(0, 200)
						}
					}

					console.error('yt-dlp error:', stderrOutput)

					this.emit('downloadProgress', {
						phase: 'error',
						percent: 0,
						message: errorMsg,
						videoId,
						chartId: options.chartId,
					})
					reject(new Error(errorMsg))
					return
				}

				// Check if temp file exists
				try {
					await fs.promises.access(tempFile)
				} catch {
					this.emit('downloadProgress', {
						phase: 'error',
						percent: 0,
						message: 'Download completed but file not found',
						videoId,
						chartId: options.chartId,
					})
					reject(new Error('Download completed but file not found'))
					return
				}

				// Check if we need to trim
				if (options.trimStart || options.trimEnd) {
					this.emit('downloadProgress', {
						phase: 'converting',
						percent: 50,
						message: 'Trimming video...',
						videoId,
						chartId: options.chartId,
					})

					try {
						await this.trimVideo(tempFile, outputFile, options.trimStart, options.trimEnd)
						await fs.promises.unlink(tempFile)
					} catch (err) {
						// If trim fails, just rename temp to output
						await fs.promises.rename(tempFile, outputFile)
					}
				} else {
					await fs.promises.rename(tempFile, outputFile)
				}

				this.emit('downloadProgress', {
					phase: 'complete',
					percent: 100,
					message: 'Complete',
					videoId,
					chartId: options.chartId,
				})

				resolve(outputFile)
			})

			process.on('error', err => {
				this.activeDownloads.delete(videoId)
				this.emit('downloadProgress', {
					phase: 'error',
					percent: 0,
					message: `Failed to run yt-dlp: ${err.message}`,
					videoId,
					chartId: options.chartId,
				})
				reject(new Error(`Failed to run yt-dlp: ${err.message}`))
			})
		})
	}

	/**
	 * Download video from any URL supported by yt-dlp
	 */
	async downloadFromUrl(url: string, outputPath: string, chartId: number): Promise<string> {
		const outputFile = path.join(outputPath, 'video.mp4')
		const tempFile = path.join(outputPath, 'video_temp.mp4')

		// Clean up any existing temp file
		try {
			await fs.promises.unlink(tempFile)
		} catch {
			// Ignore if doesn't exist
		}

		return new Promise((resolve, reject) => {
			const args = [
				url,
				'-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
				'-o', tempFile,
				'--no-playlist',
				'--merge-output-format', 'mp4',
				'--progress',
				'--newline',
			]

			const process = spawn(this.ytDlpPath, args)
			let stderrOutput = ''

			this.emit('downloadProgress', {
				phase: 'downloading',
				percent: 0,
				message: 'Starting download from URL...',
				chartId,
			})

			process.stdout.on('data', data => {
				const line = data.toString()
				const match = line.match(/(\d+\.?\d*)%/)
				if (match) {
					const percent = parseFloat(match[1])
					this.emit('downloadProgress', {
						phase: 'downloading',
						percent,
						message: `Downloading: ${percent.toFixed(1)}%`,
						chartId,
					})
				}
			})

			process.stderr.on('data', data => {
				stderrOutput += data.toString()
			})

			process.on('close', async code => {
				if (code !== 0) {
					let errorMsg = 'Download failed'
					if (stderrOutput) {
						const lines = stderrOutput.trim().split('\n').filter(l => l.trim() && !l.includes('%'))
						if (lines.length > 0) {
							errorMsg = lines[lines.length - 1].substring(0, 200)
						}
					}

					this.emit('downloadProgress', {
						phase: 'error',
						percent: 0,
						message: errorMsg,
						chartId,
					})
					reject(new Error(errorMsg))
					return
				}

				// Check if temp file exists
				try {
					await fs.promises.access(tempFile)
				} catch {
					this.emit('downloadProgress', {
						phase: 'error',
						percent: 0,
						message: 'Download completed but file not found',
						chartId,
					})
					reject(new Error('Download completed but file not found'))
					return
				}

				// Rename temp to final output
				await fs.promises.rename(tempFile, outputFile)

				this.emit('downloadProgress', {
					phase: 'complete',
					percent: 100,
					message: 'Complete',
					chartId,
				})

				resolve(outputFile)
			})

			process.on('error', err => {
				this.emit('downloadProgress', {
					phase: 'error',
					percent: 0,
					message: `Failed to run yt-dlp: ${err.message}`,
					chartId,
				})
				reject(new Error(`Failed to run yt-dlp: ${err.message}`))
			})
		})
	}

	/**
	 * Trim video using ffmpeg
	 */
	private trimVideo(
		inputFile: string,
		outputFile: string,
		trimStart?: number,
		trimEnd?: number
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const args = ['-i', inputFile]

			if (trimStart) {
				args.push('-ss', trimStart.toString())
			}

			if (trimEnd) {
				args.push('-to', trimEnd.toString())
			}

			args.push(
				'-c', 'copy',  // Copy streams without re-encoding
				'-y',          // Overwrite output
				outputFile
			)

			const process = spawn(this.ffmpegPath, args)

			process.on('close', code => {
				if (code === 0) {
					resolve()
				} else {
					reject(new Error('FFmpeg trim failed'))
				}
			})

			process.on('error', err => {
				reject(err)
			})
		})
	}

	/**
	 * Cancel an active download
	 */
	cancelDownload(videoId: string): boolean {
		const process = this.activeDownloads.get(videoId)
		if (process) {
			process.kill('SIGTERM')
			this.activeDownloads.delete(videoId)
			return true
		}
		return false
	}

	/**
	 * Check if yt-dlp is available
	 */
	async checkYtDlp(): Promise<boolean> {
		return new Promise(resolve => {
			const process = spawn(this.ytDlpPath, ['--version'])

			process.on('close', code => {
				resolve(code === 0)
			})

			process.on('error', () => {
				resolve(false)
			})
		})
	}

	/**
	 * Check if ffmpeg is available
	 */
	async checkFfmpeg(): Promise<boolean> {
		return new Promise(resolve => {
			const process = spawn(this.ffmpegPath, ['-version'])

			process.on('close', code => {
				resolve(code === 0)
			})

			process.on('error', () => {
				resolve(false)
			})
		})
	}

	/**
	 * Format seconds to MM:SS or HH:MM:SS
	 */
	private formatDuration(seconds: number | undefined): string {
		if (!seconds) return '0:00'

		const hrs = Math.floor(seconds / 3600)
		const mins = Math.floor((seconds % 3600) / 60)
		const secs = Math.floor(seconds % 60)

		if (hrs > 0) {
			return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
		}
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}
}

// Singleton
let instance: YouTubeService | null = null

export function getYouTubeService(): YouTubeService {
	if (!instance) {
		instance = new YouTubeService()
	}
	return instance
}
