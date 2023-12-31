import { z } from 'zod'

import { difficulties, instruments } from './UtilFunctions'

export const GeneralSearchSchema = z.object({
	search: z.string(),
	per_page: z.number().positive().lte(250, 'Getting more than 250 results at a time is not supported').optional(),
	page: z.number().positive(),
	instrument: z.enum(instruments).nullable(),
	difficulty: z.enum(difficulties).nullable(),
})
export type GeneralSearch = z.infer<typeof GeneralSearchSchema>

const md5Validator = z.string().regex(/^[a-f0-9]{32}$/, 'Invalid MD5 hash')

export const AdvancedSearchSchema = z.object({
	instrument: z.enum(instruments).nullable(),
	difficulty: z.enum(difficulties).nullable(),
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
	modifiedAfter: z.string().regex(/^\d+-\d{2}-\d{2}$/, 'Invalid date').or(z.coerce.date()).or(z.literal('')).nullable(),
	hash: z.string().transform(data =>
		data === '' || data.split(',').every(hash => md5Validator.safeParse(hash).success) ? data : 'invalid'
	).nullable(),
	chartHash: z.string().transform(data =>
		data === '' || data.split(',').every(hash => md5Validator.safeParse(hash).success) ? data : 'invalid'
	).nullable().optional(),
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
