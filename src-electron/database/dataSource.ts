import { DataSource } from 'typeorm'
import { Chart } from './entities/Chart.js'
import { Init1743124434920 } from './migrations/1743124434920-init.js'

const migrations = [Init1743124434920]
const entities = [Chart]

export const dataSource = new DataSource({
	type: "sqlite",
	database: "library.sqlite",
	entities: entities,
	// Configure migrations to use a folder that contains your migration files:
	migrations: migrations,
	// Keep synchronize off when using migrations in production
	synchronize: false,
	logging: true,
	migrationsRun: true,
})
