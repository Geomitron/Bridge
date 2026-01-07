import { randomUUID } from 'crypto'
import { dialog, SaveDialogOptions } from 'electron'
import { readFileSync } from 'fs'
import { outputFile } from 'fs-extra'
import { gunzip, gzip } from 'zlib'
import { promisify } from 'util'
import { inspect } from 'util'

import { dataPath, songListsPath } from '../../src-shared/Paths.js'
import {
	BridgelistFile,
	SongList,
	SongListEntry,
	SongListExportResult,
	SongListImportResult,
	SongListStorage,
} from '../../src-shared/interfaces/songlist.interface.js'
import { mainWindow } from '../main.js'
import { getCurrentVersion } from './UpdateHandler.ipc.js'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

const defaultStorage: SongListStorage = {
	version: 1,
	lists: [],
}

let songListStorage: SongListStorage = readSongLists()

function readSongLists(): SongListStorage {
	try {
		const data = JSON.parse(readFileSync(songListsPath, 'utf8')) as SongListStorage
		return data
	} catch (err) {
		if (err?.code !== 'ENOENT') {
			console.error('Failed to load song lists. Default storage will be used.\n' + inspect(err))
		}
		return { ...defaultStorage, lists: [] }
	}
}

async function writeSongLists() {
	try {
		await outputFile(songListsPath, JSON.stringify(songListStorage, undefined, 2), { encoding: 'utf8' })
	} catch (err) {
		console.error('Failed to save song lists.\n' + inspect(err))
	}
}

/**
 * @returns the current song list storage.
 */
export async function getSongLists(): Promise<SongListStorage> {
	return songListStorage
}

/**
 * Creates a new song list with the given name and description.
 * @returns the created SongList with its assigned ID.
 */
export async function createSongList(data: { name: string; description: string }): Promise<SongList> {
	const now = new Date().toISOString()
	const newList: SongList = {
		id: randomUUID(),
		name: data.name,
		description: data.description,
		createdAt: now,
		modifiedAt: now,
		entries: [],
	}
	songListStorage.lists.push(newList)
	await writeSongLists()
	return newList
}

/**
 * Updates an existing song list.
 */
export function updateSongList(list: SongList) {
	const index = songListStorage.lists.findIndex(l => l.id === list.id)
	if (index !== -1) {
		list.modifiedAt = new Date().toISOString()
		songListStorage.lists[index] = list
		writeSongLists()
	}
}

/**
 * Deletes a song list by ID.
 */
export function deleteSongList(listId: string) {
	songListStorage.lists = songListStorage.lists.filter(l => l.id !== listId)
	writeSongLists()
}

/**
 * Adds entries to a song list.
 */
export function addToSongList(data: { listId: string; entries: SongListEntry[] }) {
	const list = songListStorage.lists.find(l => l.id === data.listId)
	if (list) {
		// Avoid duplicates by checking md5
		const existingMd5s = new Set(list.entries.map(e => e.md5))
		const newEntries = data.entries.filter(e => !existingMd5s.has(e.md5))
		list.entries.push(...newEntries)
		list.modifiedAt = new Date().toISOString()
		writeSongLists()
	}
}

/**
 * Removes entries from a song list by their md5 hashes.
 */
export function removeFromSongList(data: { listId: string; md5s: string[] }) {
	const list = songListStorage.lists.find(l => l.id === data.listId)
	if (list) {
		const md5Set = new Set(data.md5s)
		list.entries = list.entries.filter(e => !md5Set.has(e.md5))
		list.modifiedAt = new Date().toISOString()
		writeSongLists()
	}
}

/**
 * Exports a song list to a .bridgelist file (gzip compressed JSON).
 */
export async function exportSongList(data: { listId: string; filePath: string }): Promise<SongListExportResult> {
	try {
		const list = songListStorage.lists.find(l => l.id === data.listId)
		if (!list) {
			return { success: false, error: 'Song list not found' }
		}

		const version = await getCurrentVersion()
		const bridgelistFile: BridgelistFile = {
			magic: 'BRIDGELIST',
			formatVersion: 1,
			data: list,
			createdBy: `Bridge ${version}`,
		}

		const jsonString = JSON.stringify(bridgelistFile)
		const compressed = await gzipAsync(jsonString)
		await outputFile(data.filePath, compressed)

		return { success: true }
	} catch (err) {
		console.error('Failed to export song list.\n' + inspect(err))
		return { success: false, error: err?.message || 'Unknown error' }
	}
}

/**
 * Imports a .bridgelist file and returns the parsed song list.
 */
export async function importSongList(filePath: string): Promise<SongListImportResult> {
	try {
		const compressed = readFileSync(filePath)
		const decompressed = await gunzipAsync(compressed)
		const bridgelistFile = JSON.parse(decompressed.toString('utf8')) as BridgelistFile

		// Validate magic header
		if (bridgelistFile.magic !== 'BRIDGELIST') {
			return { success: false, error: 'Invalid file format: not a valid .bridgelist file' }
		}

		// Validate format version
		if (bridgelistFile.formatVersion !== 1) {
			return { success: false, error: `Unsupported format version: ${bridgelistFile.formatVersion}` }
		}

		// Generate a new ID for the imported list to avoid conflicts
		const importedList: SongList = {
			...bridgelistFile.data,
			id: randomUUID(),
			modifiedAt: new Date().toISOString(),
		}

		return { success: true, list: importedList }
	} catch (err) {
		console.error('Failed to import song list.\n' + inspect(err))

		// Provide user-friendly error messages
		if (err?.code === 'Z_DATA_ERROR') {
			return { success: false, error: 'Invalid file: not a valid compressed .bridgelist file' }
		}
		if (err instanceof SyntaxError) {
			return { success: false, error: 'Invalid file: corrupted data' }
		}

		return { success: false, error: err?.message || 'Unknown error' }
	}
}

/**
 * Shows a save dialog and returns the selected path.
 */
export function showSaveDialog(options: SaveDialogOptions) {
	return dialog.showSaveDialog(mainWindow, options)
}

/**
 * Adds an imported song list to storage.
 */
export function saveImportedSongList(list: SongList) {
	songListStorage.lists.push(list)
	writeSongLists()
}
