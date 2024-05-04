import { EventType, FolderIssueType, Instrument, MetadataIssueType, NotesData } from 'scan-chart'
import { z } from 'zod'

import { difficulties, instruments, Overwrite } from '../UtilFunctions'

export const sources = ['website', 'bridge'] as const

export const GeneralSearchSchema = z.object({
	search: z.string(),
	page: z.number().positive(),
	instrument: z.enum(instruments).nullable(),
	difficulty: z.enum(difficulties).nullable(),
	source: z.enum(sources).optional(),
})
export type GeneralSearch = z.infer<typeof GeneralSearchSchema>

const md5Validator = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid MD5 hash')

export const AdvancedSearchSchema = z.object({
	instrument: z.string().refine(selectedInstruments => {
		const values = selectedInstruments.split(',')
		for (const value of values) {
			if (!instruments.includes(value as Instrument)) { return false }
		}
		return true
	}, { message: 'Invalid instrument list' }).nullable(),
	difficulty: z.enum(difficulties).nullable(),
	source: z.enum(sources).optional(),
	name: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	artist: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	album: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	genre: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	year: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	charter: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }),
	minLength: z.number().nullable(),
	maxLength: z.number().nullable(),
	minIntensity: z.number().nullable(),
	maxIntensity: z.number().nullable(),
	minAverageNPS: z.number().nullable(),
	maxAverageNPS: z.number().nullable(),
	minMaxNPS: z.number().nullable(),
	maxMaxNPS: z.number().nullable(),
	modifiedAfter: z.string().regex(/^\d+-\d{2}-\d{2}$/, 'Invalid date').or(z.literal('')).nullable(),
	hash: z.string().transform(data =>
		data === '' || data.split(',').every(hash => md5Validator.safeParse(hash).success) ? data : 'invalid'
	).nullable(),
	hasSoloSections: z.boolean().nullable(),
	hasForcedNotes: z.boolean().nullable(),
	hasOpenNotes: z.boolean().nullable(),
	hasTapNotes: z.boolean().nullable(),
	hasLyrics: z.boolean().nullable(),
	hasVocals: z.boolean().nullable(),
	hasRollLanes: z.boolean().nullable(),
	has2xKick: z.boolean().nullable(),
	hasIssues: z.boolean().nullable(),
	hasVideoBackground: z.boolean().nullable(),
	modchart: z.boolean().nullable(),
})
export type AdvancedSearch = z.infer<typeof AdvancedSearchSchema>

export const advancedSearchTextProperties = [
	'name',
	'artist',
	'album',
	'genre',
	'year',
	'charter',
] as const

export const advancedSearchNumberProperties = [
	'minLength',
	'maxLength',
	'minIntensity',
	'maxIntensity',
	'minAverageNPS',
	'maxAverageNPS',
	'minMaxNPS',
	'maxMaxNPS',
] as const

export const advancedSearchBooleanProperties = [
	'hasSoloSections',
	'hasForcedNotes',
	'hasOpenNotes',
	'hasTapNotes',
	'hasLyrics',
	'hasVocals',
	'hasRollLanes',
	'has2xKick',
	'hasIssues',
	'hasVideoBackground',
	'modchart',
] as const

export const ReportSchema = z.object({
	chartId: z.number().positive(),
	reason: z.string(),
	extraInfo: z.string(),
})
export type Report = z.infer<typeof ReportSchema>

export type NoteStringNotesData = Overwrite<NotesData, {
	maxNps: {
		notes: {
			type: keyof typeof EventType
		}[]
	}[]
}>

export interface FolderIssue {
	folderIssue: FolderIssueType
	description: string
}

export type ChartData = SearchResult['data'][number]
export interface SearchResult {
	found: number
	out_of: number
	page: number
	search_time_ms: number
	data: {
		/** The song name. */
		name: string | null
		/** The song artist. */
		artist: string | null
		/** The song album. */
		album: string | null
		/** The song genre. */
		genre: string | null
		/** The song year. */
		year: string | null
		/** The name of the chart, or `null` if the same as `name`. */
		chartName: string | null
		/** The genre of the chart, or `null` if the same as `genre`. */
		chartGenre: string | null
		/** The album of the chart, or `null` if the same as `album`. */
		chartAlbum: string | null
		/** The year of the chart, or `null` if the same as `year`. */
		chartYear: string | null
		/** The unique database identifier for the chart. */
		chartId: number
		/** The unique database identifier for the song, or `null` if there is only one chart of the song. */
		songId: number | null
		/** The unique database identifier for the song, or (-versionGroupId) if there is only one chart of the song. */
		groupId: number
		/** The MD5 hash of the normalized album art file. */
		albumArtMd5: string | null
		/** The MD5 hash of the chart folder or .sng file. */
		md5: string
		/** The MD5 hash of just the .chart or .mid file. */
		chartMd5: string
		/**
		 * Different versions of the same chart have the same `versionGroupId`.
		 * All charts in a version group have this set to the smallest `id` in the group.
		 */
		versionGroupId: number
		/** The chart's charter(s). */
		charter: string | null
		/** The length of the chart's audio, in milliseconds. If there are stems, this is the length of the longest stem. */
		song_length: number | null
		/** The difficulty rating of the chart as a whole. Usually an integer between 0 and 6 (inclusive) */
		diff_band: number | null
		/** The difficulty rating of the lead guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_guitar: number | null
		/** The difficulty rating of the co-op guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_guitar_coop: number | null
		/** The difficulty rating of the rhythm guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_rhythm: number | null
		/** The difficulty rating of the bass guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_bass: number | null
		/** The difficulty rating of the drums chart. Usually an integer between 0 and 6 (inclusive) */
		diff_drums: number | null
		/** The difficulty rating of the Phase Shift "real drums" chart. Usually an integer between 0 and 6 (inclusive) */
		diff_drums_real: number | null
		/** The difficulty rating of the keys chart. Usually an integer between 0 and 6 (inclusive) */
		diff_keys: number | null
		/** The difficulty rating of the GHL (6-fret) lead guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_guitarghl: number | null
		/** The difficulty rating of the GHL (6-fret) co-op guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_guitar_coop_ghl: number | null
		/** The difficulty rating of the GHL (6-fret) rhythm guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_rhythm_ghl: number | null
		/** The difficulty rating of the GHL (6-fret) bass guitar chart. Usually an integer between 0 and 6 (inclusive) */
		diff_bassghl: number | null
		/** The difficulty rating of the vocals chart. Usually an integer between 0 and 6 (inclusive) */
		diff_vocals: number | null
		/** The number of milliseconds into the song where the chart's audio preview should start playing. */
		preview_start_time: number | null
		/** The name of the icon to be displayed on the chart. Usually represents a charter or setlist. */
		icon: string | null
		/** A text phrase that will be displayed before the chart begins. */
		loading_phrase: string | null
		/** The ordinal position of the song on the album. This is `undefined` if it's not on an album. */
		album_track: number | null
		/** The ordinal position of the chart in its setlist. This is `undefined` if it's not on a setlist. */
		playlist_track: number | null
		/** `true` if the chart is a modchart. This only affects how the chart is filtered and displayed, and doesn't impact gameplay. */
		modchart: boolean | null
		/** The amount of time the game should delay the start of the track in milliseconds. */
		delay: number | null
		/** The amount of time the game should delay the start of the track in seconds. */
		chart_offset: number | null
		/** Overrides the default HOPO threshold with a specified value in ticks. Only applies to .mid charts. */
		hopo_frequency: number | null
		/** Sets the HOPO threshold to be a 1/8th step. Only applies to .mid charts. */
		eighthnote_hopo: boolean | null
		/** Overrides the .mid note number for Star Power on 5-Fret Guitar. Valid values are 103 and 116. Only applies to .mid charts. */
		multiplier_note: number | null
		/**
		 * The amount of time that should be skipped from the beginning of the video background in milliseconds.
		 * A negative value will delay the start of the video by that many milliseconds.
		 */
		video_start_time: number | null
		/** `true` if the "drums" track should be interpreted as 5-lane drums. */
		five_lane_drums: boolean | null
		/** `true` if the "drums" track should be interpreted as 4-lane pro drums. */
		pro_drums: boolean | null
		/** `true` if the chart's end events should be used to end the chart early. Only applies to .mid charts. */
		end_events: boolean | null
		/** Data describing properties of the .chart or .mid file. `undefined` if the .chart or .mid file couldn't be parsed. */
		notesData: NoteStringNotesData
		/** Issues with the chart files. */
		folderIssues: FolderIssue[]
		/** Issues with the chart's metadata. */
		metadataIssues: MetadataIssueType[]
		/** `true` if the chart has a video background. */
		hasVideoBackground: boolean
		/** The date of the last time this chart was modified in Google Drive. */
		modifiedTime: string

		/** The Drive ID of the chart's application folder. */
		applicationDriveId: string
		/** The primary username of the chart's application's applicant, or `null` if packName is not `null` */
		applicationUsername: string
		/** The name of the pack source, or `null` if the application is not a pack source. */
		packName: string | null
		/** The `folderId` of the Google Drive folder that contains the chart (or the shortcut to it). */
		parentFolderId: string
		/**
		 * A string containing the relative path from the application folder to the `DriveChart`.
		 *
		 * Doesn't contain the application folder name, the file name (for file charts), or leading/trailing slashes.
		 */
		drivePath: string
		/** The Drive ID of the chart file, or `null` if the chart is a chart folder. */
		driveFileId: string | null
		/** The file name of the chart file, or `null` if the chart is a chart folder. */
		driveFileName: string | null
		/** If there is more than one chart contained inside this `DriveChart`. */
		driveChartIsPack: boolean
		/**
		 * A string containing the relative path from the `DriveChart`'s archive to the chart inside the archive.
		 *
		 * Doesn't contain the archive name, the chart file name (for file charts), or leading/trailing slashes.
		 *
		 * An empty string if the `DriveChart` is not an archive.
		 */
		archivePath: string
		/**
		 * The name of the .sng file. `null` if the chart is not a .sng file.
		 */
		chartFileName: string | null
	}[]
}
