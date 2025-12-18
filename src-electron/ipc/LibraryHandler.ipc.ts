import { ChartData, LibrarySearch } from 'src-shared/interfaces/search.interface.js'

import { databaseService } from '../database/databaseService.js'

export async function addChart(chartData: ChartData): Promise<ChartData> {
	try {
		return await databaseService.insertChart(chartData)
	} catch (error) {
		console.error('Error in addChartHandler:', error)
		throw error
	}
}

export async function removeChart(md5: string): Promise<void> {
	try {
		await databaseService.removeChart(md5)
	} catch (error) {
		console.error('Error in removeChartHandler:', error)
		throw error
	}
}

export async function removeCharts(charts: ChartData[]): Promise<void> {
	try {
		await databaseService.removeCharts(charts)
	} catch (error) {
		console.error('Error in removeChartsHandler:', error)
		throw error
	}
}

export async function removeAllCharts(): Promise<void> {
	try {
		await databaseService.removeAllCharts()
	} catch (error) {
		console.error('Error in removeAllChartsHandler:', error)
		throw error
	}
}

export async function getChartsBySearchTerm(search: LibrarySearch): Promise<ChartData[]> {
	try {
		return await databaseService.getChartsBySearchTerm(search)
	} catch (error) {
		console.error('Error in getChartsHandler:', error)
		throw error
	}
}
