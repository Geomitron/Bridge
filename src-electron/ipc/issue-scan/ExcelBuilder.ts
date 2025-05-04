import exceljs, { Borders } from 'exceljs'
import _ from 'lodash'
import { FolderIssueType, ScannedChart } from 'scan-chart'

export function getChartIssues(charts: { chart: ScannedChart; path: string }[]) {
	const chartIssues: {
		path: string
		artist: string
		name: string
		charter: string
		errorName: string
		errorDescription: string
		fixMandatory: boolean
	}[] = []

	for (const chart of charts) {
		const addIssue = (
			errorName: string,
			errorDescription: string,
			fixMandatory: boolean,
		) => {

			chartIssues.push({
				path: chart.path,
				artist: removeStyleTags(chart.chart.artist ?? ''),
				name: removeStyleTags(chart.chart.name ?? ''),
				charter: removeStyleTags(chart.chart.charter ?? ''),
				errorName,
				errorDescription,
				fixMandatory,
			})
		}

		if (chart.chart.folderIssues.length > 0) {
			for (const folderIssue of chart.chart.folderIssues) {
				if (folderIssue.folderIssue === 'albumArtSize') {
					continue
				} // Ignored; .sng conversion fixes this
				addIssue(
					folderIssue.folderIssue,
					folderIssue.description,
					(
						[
							'noMetadata',
							'invalidMetadata',
							'noAudio',
							'badAudio',
							'noChart',
							'invalidChart',
							'badChart',
						] satisfies FolderIssueType[] as FolderIssueType[]
					).includes(folderIssue.folderIssue),
				)
			}
		}

		for (const metadataIssue of chart.chart.metadataIssues) {
			addIssue(
				metadataIssue.metadataIssue,
				metadataIssue.description,
				['"name"', '"artist"', '"charter"'].some(property => metadataIssue.description.includes(property)),
			)
		}

		if (chart.chart.notesData) {
			for (const issue of chart.chart.notesData.chartIssues) {
				addIssue(
					issue.noteIssue,
					`${issue.instrument ? `[${issue.instrument}]` : ''}${issue.difficulty ? `[${issue.difficulty}]` : ''} ${issue.description}`,
					issue.noteIssue === 'noNotes',
				)
			}
		}
	}

	return chartIssues
}

export async function getIssuesXLSX(
	chartIssues: Awaited<ReturnType<typeof getChartIssues>>,
) {
	const chartIssueHeaders = [
		{ text: 'Artist', width: 160 / 7 },
		{ text: 'Name', width: 400 / 7 },
		{ text: 'Charter', width: 160 / 7 },
		{ text: 'Issue Name', width: 160 / 7 },
		{
			text: 'Issue Description (a more detailed description of issue types can be '
				+ 'found at https://drive.google.com/open?id=1UK7GsP4ZHJkOg8uREFRMY72svySaDlf0QRTGlk-ruYQ)',
			width: 650 / 7,
		},
		{ text: 'Fix Mandatory?', width: 120 / 7 },
		{ text: 'Path', width: 600 / 7 },
	]
	const chartIssueRows: (string | { text: string; hyperlink: string })[][] = []
	for (const issue of chartIssues) {
		chartIssueRows.push([
			issue.artist,
			issue.name,
			issue.charter,
			issue.errorName,
			issue.errorDescription,
			issue.fixMandatory ? 'yes' : 'no',
			issue.path,
		])
	}

	const gridlineBorderStyle = {
		top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
		left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
		bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
		right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
	} satisfies Partial<Borders>
	const workbook = new exceljs.Workbook()
	workbook.creator = 'Chorus'
	workbook.created = new Date()
	workbook.modified = new Date()

	const chartIssuesWorksheet = workbook.addWorksheet('Chart Issues', {
		views: [{ state: 'frozen', ySplit: 1 }], // Sticky header row
	})
	chartIssuesWorksheet.autoFilter = {
		from: { row: 1, column: 1 },
		to: { row: chartIssueRows.length + 1, column: chartIssueHeaders.length },
	}
	chartIssueHeaders.forEach((header, index) => {
		const cell = chartIssuesWorksheet.getCell(1, index + 1)
		cell.value = header.text
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFD3D3D3' },
		}
		cell.font = { bold: true }
		const column = chartIssuesWorksheet.getColumn(index + 1)
		column.width = header.width
		column.border = gridlineBorderStyle
	})
	chartIssuesWorksheet.addRows(chartIssueRows)
	chartIssuesWorksheet.addConditionalFormatting({
		ref: `A2:${columnNumberToLetter(chartIssueHeaders.length)}${chartIssueRows.length + 1
			}`,
		rules: [
			{
				type: 'expression',
				priority: 99999,
				formulae: ['MOD(ROW(),2)=0'],
				style: {
					fill: {
						type: 'pattern',
						pattern: 'solid',
						fgColor: { argb: 'FFF7F7F7' },
					},
				},
			},
		],
	})

	return await workbook.xlsx.writeBuffer({ useStyles: true })
}

export function columnNumberToLetter(column: number) {
	let temp,
		letter = ''
	while (column > 0) {
		temp = (column - 1) % 26
		letter = String.fromCharCode(temp + 65) + letter
		column = (column - temp - 1) / 26
	}
	return letter
}

/**
 * @returns a string representation of `ms` that looks like HH:MM:SS.mm
 */
export function msToExactTime(ms: number) {
	const seconds = _.round((ms / 1000) % 60, 2)
	const minutes = Math.floor((ms / 1000 / 60) % 60)
	const hours = Math.floor(ms / 1000 / 60 / 60)
	return `${hours ? `${hours}:` : ''}${_.padStart(
		minutes + '',
		2,
		'0',
	)}:${_.padStart(seconds.toFixed(2), 5, '0')}`
}

const allowedTags = [
	'align',
	'allcaps',
	'alpha',
	'b',
	'br',
	'color',
	'cspace',
	'font',
	'font-weight',
	'gradient',
	'i',
	'indent',
	'line-height',
	'line-indent',
	'link',
	'lowercase',
	'margin',
	'mark',
	'mspace',
	'nobr',
	'noparse',
	'page',
	'pos',
	'rotate',
	's',
	'size',
	'smallcaps',
	'space',
	'sprite',
	'strikethrough',
	'style',
	'sub',
	'sup',
	'u',
	'uppercase',
	'voffset',
	'width',
]
const tagPattern = allowedTags.map(tag => `\\b${tag}\\b`).join('|')
/**
 * @returns `text` with all style tags removed. (e.g. "<color=#AEFFFF>Aren Eternal</color> & Geo" -> "Aren Eternal & Geo")
 */
export function removeStyleTags(text: string) {
	let oldText = text
	let newText = text
	do {
		oldText = newText
		newText = newText
			.replace(new RegExp(`<\\s*\\/?\\s*(?:#|${tagPattern})[^>]*>`, 'gi'), '')
			.trim()
	} while (newText !== oldText)
	return newText
}
