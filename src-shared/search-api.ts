import { z } from 'zod'

import { difficulties, drumTypeNames, instruments } from './UtilFunctions.js'

export const searchSortProperties = ['name', 'artist', 'album', 'genre', 'year', 'charter', 'length', 'modifiedTime'] as const
export const sources = ['api'] as const

export const GeneralSearchSchema = z.object({
	search: z.string(),
	per_page: z.number().positive().lte(250, 'Getting more than 250 results at a time is not supported').optional(),
	page: z.number().positive(),
	instrument: z.enum(instruments).nullable().default(null),
	difficulty: z.enum(difficulties).nullable().default(null),
	drumType: z.enum(drumTypeNames).nullable().default(null),
	drumsReviewed: z.boolean().optional().default(true),
	sort: z
		.object({ type: z.enum(searchSortProperties), direction: z.enum(['asc', 'desc']) })
		.nullable()
		.default(null),
	source: z.enum(sources).optional(),
})
export type GeneralSearch = z.infer<typeof GeneralSearchSchema>

const md5Validator = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid MD5 hash')
const blakeValidator = z.string().regex(/^[A-Za-z0-9-_]+={0,2}$/, 'Invalid hash')

export const AdvancedSearchSchema = z.object({
	instrument: z.enum(instruments).nullable().default(null),
	difficulty: z.enum(difficulties).nullable().default(null),
	drumType: z.enum(drumTypeNames).nullable().default(null),
	drumsReviewed: z.boolean().optional().default(true),
	sort: z
		.object({ type: z.enum(searchSortProperties), direction: z.enum(['asc', 'desc']) })
		.nullable()
		.default(null),
	source: z.enum(sources).optional(),
	per_page: z.number().positive().lte(250, 'Getting more than 250 results at a time is not supported').optional(),
	page: z.number().positive().optional(),
	name: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	artist: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	album: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	genre: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	year: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	charter: z.object({ value: z.string(), exact: z.boolean(), exclude: z.boolean() }).nullable().default(null),
	minLength: z.number().nullable().default(null),
	maxLength: z.number().nullable().default(null),
	minIntensity: z.number().nullable().default(null),
	maxIntensity: z.number().nullable().default(null),
	minAverageNPS: z.number().nullable().default(null),
	maxAverageNPS: z.number().nullable().default(null),
	minMaxNPS: z.number().nullable().default(null),
	maxMaxNPS: z.number().nullable().default(null),
	minYear: z.number().nullable().default(null),
	maxYear: z.number().nullable().default(null),
	modifiedAfter: z
		.string()
		.regex(/^\d+-\d{2}-\d{2}$/, 'Invalid date')
		.or(z.coerce.date())
		.or(z.literal(''))
		.nullable()
		.default(null),
	hash: z
		.string()
		.transform(data => (data === '' || data.split(',').every(hash => md5Validator.safeParse(hash).success) ? data : 'invalid'))
		.nullable()
		.default(null),
	chartHash: z
		.string()
		.transform(data => (data === '' || data.split(',').every(hash => md5Validator.safeParse(hash).success) ? data : 'invalid'))
		.nullable()
		.optional(),
	trackHash: z
		.string()
		.transform(data => (data === '' || data.split(',').every(hash => blakeValidator.safeParse(hash).success) ? data : 'invalid'))
		.nullable()
		.optional(),
	hasSoloSections: z.boolean().nullable().default(null),
	hasForcedNotes: z.boolean().nullable().default(null),
	hasOpenNotes: z.boolean().nullable().default(null),
	hasTapNotes: z.boolean().nullable().default(null),
	hasLyrics: z.boolean().nullable().default(null),
	hasVocals: z.boolean().nullable().default(null),
	hasRollLanes: z.boolean().nullable().default(null),
	has2xKick: z.boolean().nullable().default(null),
	hasIssues: z.boolean().nullable().default(null),
	hasVideoBackground: z.boolean().nullable().default(null),
	modchart: z.boolean().nullable().default(null),
	chartIdAfter: z.number().positive().optional(),
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
	'minYear',
	'maxYear',
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
