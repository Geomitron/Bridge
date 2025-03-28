import { Injectable } from '@angular/core'
import { ChartData } from 'src-shared/interfaces/search.interface'

@Injectable({
	providedIn: 'root',
})
export class StorageService {
	async addChart(chartData: ChartData): Promise<ChartData> {
		return window.electron.invoke.addChart(chartData)
	}

	async removeChart(md5: string): Promise<void> {
		return window.electron.invoke.removeChart(md5)
	}

	async removeCharts(charts: ChartData[]): Promise<void> {
		return window.electron.invoke.removeCharts(charts)
	}

	async getChartsBySearchTerm(searchTerm?: string): Promise<ChartData[]> {
		return window.electron.invoke.getChartsBySearchTerm(searchTerm)
	}

	async removeAllCharts(): Promise<void> {
		return window.electron.emit.removeAllCharts()
	}
}
