/**
 * Bridge Art Studio Module - Image Service
 * Handles image search, album art fetching, and background generation
 */

import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { EventEmitter } from 'eventemitter3'
import { spawn } from 'child_process'
import {
	ImageSearchResult,
	AlbumArtResult,
	ArtDownloadProgress,
	ArtDownloadOptions,
	BackgroundGenerateOptions,
} from '../../../src-shared/interfaces/art-studio.interface.js'

interface ImageServiceEvents {
	progress: (progress: ArtDownloadProgress) => void
}

class ImageService extends EventEmitter<ImageServiceEvents> {

	/**
	 * Search for album art using iTunes Search API (free, no key required)
	 */
	async searchAlbumArt(artist: string, album: string): Promise<AlbumArtResult[]> {
		const results: AlbumArtResult[] = []

		// Try iTunes Search API
		try {
			const itunesResults = await this.searchiTunes(artist, album)
			results.push(...itunesResults)
		} catch (err) {
			console.error('iTunes search failed:', err)
		}

		// Try with just artist + track name if album search fails
		if (results.length === 0) {
			try {
				const itunesResults = await this.searchiTunes(artist, '')
				results.push(...itunesResults)
			} catch (err) {
				console.error('iTunes artist search failed:', err)
			}
		}

		return results
	}

	private async searchiTunes(artist: string, album: string): Promise<AlbumArtResult[]> {
		return new Promise((resolve, reject) => {
			const query = album
				? `${artist} ${album}`.trim()
				: artist.trim()

			const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=10`

			https.get(url, res => {
				let data = ''
				res.on('data', chunk => data += chunk)
				res.on('end', () => {
					try {
						const json = JSON.parse(data)
						const results: AlbumArtResult[] = []

						for (const item of json.results || []) {
							if (item.artworkUrl100) {
								// iTunes provides 100x100, we can request larger
								const largeUrl = item.artworkUrl100
									.replace('100x100', '600x600')
									.replace('100x100bb', '600x600bb')

								results.push({
									url: largeUrl,
									size: 'large',
									source: 'itunes',
								})

								// Also add medium size
								results.push({
									url: item.artworkUrl100.replace('100x100', '300x300'),
									size: 'medium',
									source: 'itunes',
								})
							}
						}

						resolve(results)
					} catch (err) {
						reject(err)
					}
				})
			}).on('error', reject)
		})
	}

	/**
	 * Search for background images using Unsplash (requires no auth for demo)
	 * Falls back to generating a gradient background
	 */
	async searchBackgrounds(query: string): Promise<ImageSearchResult[]> {
		// For now, we'll generate backgrounds locally instead of searching
		// This avoids API key requirements
		return []
	}

	/**
	 * Download an image to the specified path
	 */
	async downloadImage(options: ArtDownloadOptions): Promise<string> {
		const { chartId, imageUrl, outputPath, type } = options

		const filename = type === 'album' ? 'album.png' : 'background.png'
		const destPath = path.join(outputPath, filename)

		this.emit('progress', {
			phase: 'downloading',
			percent: 0,
			message: `Downloading ${type}...`,
			chartId,
		})

		// Delete any existing files of the same type before downloading
		try {
			const entries = await fs.promises.readdir(outputPath)
			for (const entry of entries) {
				const lower = entry.toLowerCase()
				if (type === 'album' && (lower === 'album.png' || lower === 'album.jpg' || lower === 'album.jpeg')) {
					await fs.promises.unlink(path.join(outputPath, entry))
				} else if (type === 'background' && lower.startsWith('background') &&
					(lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
					await fs.promises.unlink(path.join(outputPath, entry))
				}
			}
		} catch (err) {
			console.error('Failed to clean up existing files:', err)
		}

		return new Promise((resolve, reject) => {
			const protocol = imageUrl.startsWith('https') ? https : http

			const request = protocol.get(imageUrl, response => {
				// Handle redirects
				if (response.statusCode === 301 || response.statusCode === 302) {
					const redirectUrl = response.headers.location
					if (redirectUrl) {
						this.downloadImage({ ...options, imageUrl: redirectUrl })
							.then(resolve)
							.catch(reject)
						return
					}
				}

				if (response.statusCode !== 200) {
					reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
					return
				}

				const totalSize = parseInt(response.headers['content-length'] || '0', 10)
				let downloadedSize = 0

				const fileStream = fs.createWriteStream(destPath)

				response.on('data', chunk => {
					downloadedSize += chunk.length
					if (totalSize > 0) {
						const percent = Math.round((downloadedSize / totalSize) * 100)
						this.emit('progress', {
							phase: 'downloading',
							percent,
							message: `Downloading ${type}: ${percent}%`,
							chartId,
						})
					}
				})

				response.pipe(fileStream)

				fileStream.on('finish', () => {
					fileStream.close()
					this.emit('progress', {
						phase: 'complete',
						percent: 100,
						message: 'Complete',
						chartId,
					})
					resolve(destPath)
				})

				fileStream.on('error', err => {
					fs.unlink(destPath, () => { }) // Clean up partial file
					reject(err)
				})
			})

			request.on('error', reject)
			request.setTimeout(30000, () => {
				request.destroy()
				reject(new Error('Download timeout'))
			})
		})
	}

	/**
	 * Generate a background image from album art (blur effect)
	 * Uses ImageMagick if available, otherwise creates a solid color
	 */
	async generateBackground(options: BackgroundGenerateOptions): Promise<string> {
		const { chartId, outputPath, style, albumArtPath, blurAmount = 50 } = options
		const destPath = path.join(outputPath, 'background.png')

		this.emit('progress', {
			phase: 'processing',
			percent: 0,
			message: 'Generating background...',
			chartId,
		})

		// Delete any existing background files first
		try {
			const entries = await fs.promises.readdir(outputPath)
			for (const entry of entries) {
				const lower = entry.toLowerCase()
				if (lower.startsWith('background') &&
					(lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))) {
					await fs.promises.unlink(path.join(outputPath, entry))
				}
			}
		} catch (err) {
			console.error('Failed to clean up existing background files:', err)
		}

		// Check if we have album art to work with
		if (albumArtPath && style === 'blur') {
			try {
				await this.createBlurredBackground(albumArtPath, destPath, blurAmount)
				this.emit('progress', {
					phase: 'complete',
					percent: 100,
					message: 'Background generated',
					chartId,
				})
				return destPath
			} catch (err) {
				console.error('Failed to create blurred background:', err)
				// Fall back to gradient
			}
		}

		// Generate a gradient or solid background using canvas-like approach
		// Since we can't use canvas in Electron main process easily,
		// we'll create a simple PPM file and convert it
		await this.createGradientBackground(destPath, options.baseColor)

		this.emit('progress', {
			phase: 'complete',
			percent: 100,
			message: 'Background generated',
			chartId,
		})

		return destPath
	}

	/**
	 * Create a blurred background from album art using ffmpeg
	 */
	private createBlurredBackground(sourcePath: string, destPath: string, blurAmount: number = 50): Promise<void> {
		return new Promise((resolve, reject) => {
			// Use ffmpeg to blur and scale the image
			// blurAmount is the sigma value for gaussian blur (0 = no blur, 50 = heavy blur)
			const blurFilter = blurAmount > 0 ? `,gblur=sigma=${blurAmount}` : ''
			const args = [
				'-i', sourcePath,
				'-vf', `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080${blurFilter}`,
				'-y',
				destPath,
			]

			console.log('Creating blurred background:', { sourcePath, destPath, blurAmount, blurFilter })
			const process = spawn('ffmpeg', args)

			let stderr = ''
			process.stderr.on('data', data => {
				stderr += data.toString()
			})

			process.on('close', code => {
				if (code === 0) {
					resolve()
				} else {
					console.error('ffmpeg stderr:', stderr)
					reject(new Error(`ffmpeg exited with code ${code}`))
				}
			})

			process.on('error', err => {
				reject(err)
			})
		})
	}

	/**
	 * Create a simple gradient background as fallback
	 */
	private async createGradientBackground(destPath: string, baseColor?: string): Promise<void> {
		// Create a simple 1920x1080 gradient using ffmpeg
		const color1 = baseColor || '#1a1a2e'
		const color2 = '#16213e'

		return new Promise((resolve, reject) => {
			const args = [
				'-f', 'lavfi',
				'-i', `color=c=${color1}:s=1920x1080:d=1`,
				'-vf', `gradients=c0=${color1}:c1=${color2}:x0=0:y0=0:x1=1920:y1=1080`,
				'-frames:v', '1',
				'-y',
				destPath,
			]

			const process = spawn('ffmpeg', args)
			let stderr = ''

			process.stderr.on('data', data => {
				stderr += data.toString()
			})

			process.on('close', code => {
				if (code === 0) {
					resolve()
				} else {
					// Fallback: create solid color image
					this.createSolidBackground(destPath, color1)
						.then(resolve)
						.catch(reject)
				}
			})

			process.on('error', () => {
				// Fallback: create solid color image
				this.createSolidBackground(destPath, color1)
					.then(resolve)
					.catch(reject)
			})
		})
	}

	/**
	 * Create a solid color background as ultimate fallback
	 */
	private createSolidBackground(destPath: string, color: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const args = [
				'-f', 'lavfi',
				'-i', `color=c=${color}:s=1920x1080`,
				'-frames:v', '1',
				'-y',
				destPath,
			]

			const process = spawn('ffmpeg', args)

			process.on('close', code => {
				if (code === 0) {
					resolve()
				} else {
					reject(new Error('Failed to create background'))
				}
			})

			process.on('error', reject)
		})
	}

	/**
	 * Check if ffmpeg is available
	 */
	async checkFfmpeg(): Promise<boolean> {
		return new Promise(resolve => {
			const process = spawn('ffmpeg', ['-version'])

			process.on('close', code => {
				resolve(code === 0)
			})

			process.on('error', () => {
				resolve(false)
			})
		})
	}
}

// Singleton
let instance: ImageService | null = null

export function getImageService(): ImageService {
	if (!instance) {
		instance = new ImageService()
	}
	return instance
}
