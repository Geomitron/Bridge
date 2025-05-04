import { ChartData, LibrarySearch } from 'src-shared/interfaces/search.interface.js'
import { Like } from 'typeorm'

import { dataSource } from './dataSource.js'
import { Chart } from './entities/Chart.js'

export class DatabaseService {
	async insertChart(chartData: ChartData): Promise<ChartData> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			const existingChart = await chartRepository.findOneBy({ md5: chartData.md5 })

			if (existingChart) {
				return existingChart as unknown as ChartData
			}

			const newChart = chartRepository.create({
				name: chartData.name!,
				album: chartData.album!,
				artist: chartData.artist!,
				genre: chartData.genre!,
				year: chartData.year!,
				charter: chartData.charter!,
				md5: chartData.md5,
				hasVideoBackground: chartData.hasVideoBackground,
			})

			return await chartRepository.save(newChart) as unknown as ChartData
		} catch (error) {
			console.error('Error inserting chart:', error)
			throw error
		}
	}

	async removeChart(md5: string): Promise<void> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			await chartRepository.delete({ md5 })

		} catch (error) {
			console.error('Error removing chart:', error)
			throw error
		}
	}

	async removeCharts(charts: ChartData[]): Promise<void> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			charts.forEach(async chart => {
				console.log('removing chart:', chart.name)
				await chartRepository.delete({ md5: chart.md5 })
			})
		} catch (error) {
			console.error('Error removing charts:', error)
			throw error
		}
	}

	async getChartsBySearchTerm(search: LibrarySearch): Promise<ChartData[]> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			let charts: Chart[]

			if (search.searchTerm?.trim()) {
				const likeSearchTerm = Like(`%${search.searchTerm}%`)

				charts = await chartRepository.find({
					where: [
						{ name: likeSearchTerm },
						{ album: likeSearchTerm },
						{ artist: likeSearchTerm },
						{ genre: likeSearchTerm },
						{ year: likeSearchTerm },
						{ charter: likeSearchTerm },
					],
					skip: (search.page - 1) * search.pageSize,
					take: search.pageSize,
				})
			} else {
				charts = await chartRepository.find({
					skip: (search.page - 1) * search.pageSize,
					take: search.pageSize,
				})
			}
			return charts as unknown as ChartData[]
		} catch (error) {
			console.error('Error fetching charts by search term:', error)
			throw error
		}
	}

	async removeAllCharts(): Promise<void> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			await chartRepository.clear()
		} catch (error) {
			console.error('Error removing all charts:', error)
			throw error
		}
	}
}

export const databaseService = new DatabaseService()
