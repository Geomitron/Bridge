/**
 * Cached metadata for offline preview of a song list entry.
 */
export interface SongListEntryCache {
	name: string | null
	artist: string | null
	album: string | null
	charter: string | null
}

/**
 * A single entry in a song list. Contains minimal data for API lookup
 * plus cached metadata for offline preview.
 */
export interface SongListEntry {
	/** Primary identifier - MD5 hash of chart folder/sng file */
	md5: string
	/** Database chart ID for API lookup */
	chartId: number
	/** Cached display metadata for offline preview */
	cache: SongListEntryCache
	/** Timestamp when entry was added to the list (ISO 8601) */
	addedAt: string
}

/**
 * A named collection of songs that can be managed, exported, and shared.
 */
export interface SongList {
	/** Unique identifier for the list (UUID v4) */
	id: string
	/** User-defined name for the list */
	name: string
	/** Optional description */
	description: string
	/** When the list was created (ISO 8601) */
	createdAt: string
	/** When the list was last modified (ISO 8601) */
	modifiedAt: string
	/** The songs in this list */
	entries: SongListEntry[]
}

/**
 * Root storage structure for all local song lists.
 */
export interface SongListStorage {
	/** Schema version for future migrations */
	version: 1
	/** All local song lists */
	lists: SongList[]
}

/**
 * File format for exported .bridgelist files.
 */
export interface BridgelistFile {
	/** Magic identifier for file validation */
	magic: 'BRIDGELIST'
	/** File format version */
	formatVersion: 1
	/** The song list data */
	data: SongList
	/** App version that created this file */
	createdBy?: string
}

/**
 * Result of importing a .bridgelist file.
 */
export interface SongListImportResult {
	success: boolean
	list?: SongList
	error?: string
}

/**
 * Result of exporting a song list.
 */
export interface SongListExportResult {
	success: boolean
	error?: string
}
