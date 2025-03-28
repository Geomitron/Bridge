import { ChartData } from 'src-shared/interfaces/search.interface.js'
import { dataSource } from './dataSource.js'
import { Chart } from './entities/Chart.js'
import { Like } from 'typeorm'

export class DatabaseService {
	async insertChart(chartData: ChartData): Promise<ChartData> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			// if one already exist dont create
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

			// delete the array of charts provided using querybulilder
			charts.forEach(async chart => {
				console.log('removing chart:', chart.name)
				await chartRepository.delete({ md5: chart.md5 })
			})
		} catch (error) {
			console.error('Error removing charts:', error)
			throw error
		}
	}

	async getChartsBySearchTerm(searchTerm?: string): Promise<ChartData[]> {
		try {
			if (!dataSource.isInitialized) {
				await dataSource.initialize()
			}

			const chartRepository = dataSource.getRepository(Chart)

			let charts: Chart[]

			if (searchTerm) {
				const likeSearchTerm = `%${searchTerm}%`
				charts = await chartRepository.find({
					where: [
						{ name: Like(likeSearchTerm) },
						{ album: Like(likeSearchTerm) },
						{ artist: Like(likeSearchTerm) },
						{ genre: Like(likeSearchTerm) },
						{ year: Like(likeSearchTerm) },
						{ charter: Like(likeSearchTerm) },
					],
				})
			} else {
				charts = await chartRepository.find()
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
