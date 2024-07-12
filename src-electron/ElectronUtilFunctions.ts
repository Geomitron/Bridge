import { randomBytes } from 'crypto'
import { parse } from 'path'
import sanitize from 'sanitize-filename'
import { inspect } from 'util'

import { lower } from '../src-shared/UtilFunctions.js'
import { emitIpcEvent } from './main.js'

/**
 * @returns `true` if `name` has a valid video file extension.
 */
export function hasVideoExtension(name: string) {
	return (['.mp4', '.avi', '.webm', '.ogv', '.mpeg'].includes(parse(lower(name)).ext))
}

/**
 * Log a message in the main BrowserWindow's console.
 */
export function devLog(message: unknown) {
	emitIpcEvent('errorLog', typeof message === 'string' ? message : inspect(message))
}

/**
 * @returns `filename` with all invalid filename characters replaced.
 */
export function sanitizeFilename(filename: string): string {
	const newFilename = sanitize(filename, {
		replacement: ((invalidChar: string) => {
			switch (invalidChar) {
				case '<': return '❮'
				case '>': return '❯'
				case ':': return '꞉'
				case '"': return "'"
				case '/': return '／'
				case '\\': return '⧵'
				case '|': return '⏐'
				case '?': return '？'
				case '*': return '⁎'
				default: return '_'
			}
		}),
	})
	return (newFilename === '' ? randomBytes(5).toString('hex') : newFilename)
}
