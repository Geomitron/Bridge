/**
 * Bridge Catalog Manager - Database Service
 * Handles SQLite operations for the local chart catalog
 */

import Database from 'better-sqlite3'
import * as path from 'path'
import { ChartRecord, CatalogFilter, CatalogStats } from '../../../src-shared/interfaces/catalog.interface.js'
import { dataPath } from '../../../src-shared/Paths.js'

/** Helper to convert boolean to SQLite integer */
const boolToInt = (val: boolean): number => val ? 1 : 0

/** Result of building filter clauses */
interface FilterResult {
	whereClause: string
	params: Record<string, unknown>
}

class CatalogDatabase {
	private db: Database.Database
	private dbPath: string

	// Prepared statements cache for frequently used queries
	private stmtCache: Map<string, Database.Statement> = new Map()

	constructor() {
		this.dbPath = path.join(dataPath, 'catalog.db')
		this.db = new Database(this.dbPath)
		this.db.pragma('journal_mode = WAL')
		this.initializeSchema()
	}

	private initializeSchema(): void {
		// First, add new columns if they don't exist (for existing databases)
		// This must happen BEFORE creating indexes on these columns
		this.addColumnIfNotExists('charts', 'diff_rhythm', 'INTEGER')
		this.addColumnIfNotExists('charts', 'diff_guitarghl', 'INTEGER')
		this.addColumnIfNotExists('charts', 'diff_bassghl', 'INTEGER')
		this.addColumnIfNotExists('charts', 'hasGuitar', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasBass', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasDrums', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasKeys', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasVocals', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasRhythm', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'hasGHL', 'INTEGER DEFAULT 0')
		this.addColumnIfNotExists('charts', 'chartType', 'TEXT')
		// Difficulty level columns
		this.addColumnIfNotExists('charts', 'guitarDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'bassDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'drumsDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'keysDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'vocalsDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'rhythmDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'ghlGuitarDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'ghlBassDiffs', 'TEXT DEFAULT ""')
		this.addColumnIfNotExists('charts', 'hasLyrics', 'INTEGER DEFAULT 0')

		this.db.exec(`
      CREATE TABLE IF NOT EXISTS charts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,

        -- Metadata
        name TEXT NOT NULL DEFAULT '',
        artist TEXT NOT NULL DEFAULT '',
        album TEXT DEFAULT '',
        genre TEXT DEFAULT '',
        year INTEGER,
        charter TEXT DEFAULT '',

        -- Difficulties (tier rating 0-6)
        diff_guitar INTEGER,
        diff_bass INTEGER,
        diff_drums INTEGER,
        diff_keys INTEGER,
        diff_vocals INTEGER,
        diff_rhythm INTEGER,
        diff_guitarghl INTEGER,
        diff_bassghl INTEGER,

        -- Instruments available
        hasGuitar INTEGER DEFAULT 0,
        hasBass INTEGER DEFAULT 0,
        hasDrums INTEGER DEFAULT 0,
        hasKeys INTEGER DEFAULT 0,
        hasVocals INTEGER DEFAULT 0,
        hasRhythm INTEGER DEFAULT 0,
        hasGHL INTEGER DEFAULT 0,

        -- Difficulty levels available (e,m,h,x)
        guitarDiffs TEXT DEFAULT '',
        bassDiffs TEXT DEFAULT '',
        drumsDiffs TEXT DEFAULT '',
        keysDiffs TEXT DEFAULT '',
        vocalsDiffs TEXT DEFAULT '',
        rhythmDiffs TEXT DEFAULT '',
        ghlGuitarDiffs TEXT DEFAULT '',
        ghlBassDiffs TEXT DEFAULT '',

        -- Chart file type
        chartType TEXT,

        -- Asset flags
        hasVideo INTEGER DEFAULT 0,
        hasBackground INTEGER DEFAULT 0,
        hasAlbumArt INTEGER DEFAULT 0,
        hasStems INTEGER DEFAULT 0,
        hasLyrics INTEGER DEFAULT 0,

        -- Audio info
        songLength INTEGER,
        previewStart INTEGER,

        -- Tracking
        chorusId TEXT,
        folderHash TEXT,
        lastScanned TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_charts_artist ON charts(artist);
      CREATE INDEX IF NOT EXISTS idx_charts_name ON charts(name);
      CREATE INDEX IF NOT EXISTS idx_charts_charter ON charts(charter);
      CREATE INDEX IF NOT EXISTS idx_charts_hasVideo ON charts(hasVideo);
      CREATE INDEX IF NOT EXISTS idx_charts_hasBackground ON charts(hasBackground);

      -- Composite index for efficient library existence checks (used by browse tab)
      CREATE INDEX IF NOT EXISTS idx_charts_existence ON charts(artist COLLATE NOCASE, name COLLATE NOCASE, charter COLLATE NOCASE);

      -- Full-text search virtual table
      CREATE VIRTUAL TABLE IF NOT EXISTS charts_fts USING fts5(
        name, artist, album, charter, genre,
        content='charts',
        content_rowid='id'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS charts_ai AFTER INSERT ON charts BEGIN
        INSERT INTO charts_fts(rowid, name, artist, album, charter, genre)
        VALUES (new.id, new.name, new.artist, new.album, new.charter, new.genre);
      END;

      CREATE TRIGGER IF NOT EXISTS charts_ad AFTER DELETE ON charts BEGIN
        INSERT INTO charts_fts(charts_fts, rowid, name, artist, album, charter, genre)
        VALUES ('delete', old.id, old.name, old.artist, old.album, old.charter, old.genre);
      END;

      CREATE TRIGGER IF NOT EXISTS charts_au AFTER UPDATE ON charts BEGIN
        INSERT INTO charts_fts(charts_fts, rowid, name, artist, album, charter, genre)
        VALUES ('delete', old.id, old.name, old.artist, old.album, old.charter, old.genre);
        INSERT INTO charts_fts(rowid, name, artist, album, charter, genre)
        VALUES (new.id, new.name, new.artist, new.album, new.charter, new.genre);
      END;

      -- Settings table for catalog-specific settings
      CREATE TABLE IF NOT EXISTS catalog_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `)

		// Create index on chartType after ensuring the column exists
		try {
			this.db.exec(`CREATE INDEX IF NOT EXISTS idx_charts_chartType ON charts(chartType)`)
		} catch {
			// Index might fail if column doesn't exist yet on very old DBs
		}
	}

	private addColumnIfNotExists(table: string, column: string, type: string): void {
		try {
			// Check if table exists first
			const tableExists = this.db.prepare(
				`SELECT name FROM sqlite_master WHERE type='table' AND name=?`
			).get(table)

			if (!tableExists) return // Table doesn't exist yet, will be created with column

			this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
		} catch {
			// Column already exists or table doesn't exist
		}
	}

	/**
	 * Build filter clauses for getCharts/getChartsCount queries
	 * Extracts shared logic to avoid duplication
	 */
	private buildFilterClauses(filter: CatalogFilter): FilterResult {
		const conditions: string[] = []
		const params: Record<string, unknown> = {}

		// Full-text search handled separately since it changes the base query
		if (filter.search) {
			params.search = filter.search.replace(/['"]/g, '').split(/\s+/).map(t => `${t}*`).join(' ')
		}

		// Exact filters
		if (filter.artist) {
			conditions.push('artist = @artist')
			params.artist = filter.artist
		}
		if (filter.charter) {
			conditions.push('charter = @charter')
			params.charter = filter.charter
		}
		if (filter.genre) {
			conditions.push('genre = @genre')
			params.genre = filter.genre
		}
		if (filter.album) {
			conditions.push('album = @album')
			params.album = filter.album
		}

		// Chart type filter
		if (filter.chartType) {
			conditions.push('chartType = @chartType')
			params.chartType = filter.chartType
		}

		// Asset filters
		if (filter.hasVideo !== undefined) {
			conditions.push('hasVideo = @hasVideo')
			params.hasVideo = boolToInt(filter.hasVideo)
		}
		if (filter.hasBackground !== undefined) {
			conditions.push('hasBackground = @hasBackground')
			params.hasBackground = boolToInt(filter.hasBackground)
		}
		if (filter.hasAlbumArt !== undefined) {
			conditions.push('hasAlbumArt = @hasAlbumArt')
			params.hasAlbumArt = boolToInt(filter.hasAlbumArt)
		}
		if (filter.hasLyrics !== undefined) {
			conditions.push('hasLyrics = @hasLyrics')
			params.hasLyrics = boolToInt(filter.hasLyrics)
		}

		// Instrument filters
		if (filter.hasGuitar !== undefined) {
			conditions.push('hasGuitar = @hasGuitar')
			params.hasGuitar = boolToInt(filter.hasGuitar)
		}
		if (filter.hasBass !== undefined) {
			conditions.push('hasBass = @hasBass')
			params.hasBass = boolToInt(filter.hasBass)
		}
		if (filter.hasDrums !== undefined) {
			conditions.push('hasDrums = @hasDrums')
			params.hasDrums = boolToInt(filter.hasDrums)
		}
		if (filter.hasKeys !== undefined) {
			conditions.push('hasKeys = @hasKeys')
			params.hasKeys = boolToInt(filter.hasKeys)
		}
		if (filter.hasVocals !== undefined) {
			conditions.push('hasVocals = @hasVocals')
			params.hasVocals = boolToInt(filter.hasVocals)
		}

		// Difficulty level filters
		if (filter.guitarDiff) {
			conditions.push('guitarDiffs LIKE @guitarDiff')
			params.guitarDiff = `%${filter.guitarDiff}%`
		}
		if (filter.bassDiff) {
			conditions.push('bassDiffs LIKE @bassDiff')
			params.bassDiff = `%${filter.bassDiff}%`
		}
		if (filter.drumsDiff) {
			conditions.push('drumsDiffs LIKE @drumsDiff')
			params.drumsDiff = `%${filter.drumsDiff}%`
		}
		if (filter.keysDiff) {
			conditions.push('keysDiffs LIKE @keysDiff')
			params.keysDiff = `%${filter.keysDiff}%`
		}

		// Difficulty tier filter (legacy)
		if (filter.instrument && (filter.minDifficulty !== undefined || filter.maxDifficulty !== undefined)) {
			const diffCol = `diff_${filter.instrument}`
			if (filter.minDifficulty !== undefined) {
				conditions.push(`${diffCol} >= @minDiff`)
				params.minDiff = filter.minDifficulty
			}
			if (filter.maxDifficulty !== undefined) {
				conditions.push(`${diffCol} <= @maxDiff`)
				params.maxDiff = filter.maxDifficulty
			}
		}

		return {
			whereClause: conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '',
			params,
		}
	}

	/**
	 * Convert chart record to database params with boolean conversion
	 */
	private chartToDbParams(chart: Omit<ChartRecord, 'id'>): Record<string, unknown> {
		return {
			...chart,
			hasGuitar: boolToInt(chart.hasGuitar),
			hasBass: boolToInt(chart.hasBass),
			hasDrums: boolToInt(chart.hasDrums),
			hasKeys: boolToInt(chart.hasKeys),
			hasVocals: boolToInt(chart.hasVocals),
			hasRhythm: boolToInt(chart.hasRhythm),
			hasGHL: boolToInt(chart.hasGHL),
			hasVideo: boolToInt(chart.hasVideo),
			hasBackground: boolToInt(chart.hasBackground),
			hasAlbumArt: boolToInt(chart.hasAlbumArt),
			hasStems: boolToInt(chart.hasStems),
			hasLyrics: boolToInt(chart.hasLyrics),
		}
	}

	upsertChart(chart: Omit<ChartRecord, 'id'>): number {
		const cacheKey = 'upsertChart'
		let stmt = this.stmtCache.get(cacheKey)

		if (!stmt) {
			stmt = this.db.prepare(`
        INSERT INTO charts (
          path, name, artist, album, genre, year, charter,
          diff_guitar, diff_bass, diff_drums, diff_keys, diff_vocals,
          diff_rhythm, diff_guitarghl, diff_bassghl,
          hasGuitar, hasBass, hasDrums, hasKeys, hasVocals, hasRhythm, hasGHL,
          guitarDiffs, bassDiffs, drumsDiffs, keysDiffs, vocalsDiffs, rhythmDiffs, ghlGuitarDiffs, ghlBassDiffs,
          chartType,
          hasVideo, hasBackground, hasAlbumArt, hasStems, hasLyrics,
          songLength, previewStart, chorusId, folderHash, lastScanned
        ) VALUES (
          @path, @name, @artist, @album, @genre, @year, @charter,
          @diff_guitar, @diff_bass, @diff_drums, @diff_keys, @diff_vocals,
          @diff_rhythm, @diff_guitarghl, @diff_bassghl,
          @hasGuitar, @hasBass, @hasDrums, @hasKeys, @hasVocals, @hasRhythm, @hasGHL,
          @guitarDiffs, @bassDiffs, @drumsDiffs, @keysDiffs, @vocalsDiffs, @rhythmDiffs, @ghlGuitarDiffs, @ghlBassDiffs,
          @chartType,
          @hasVideo, @hasBackground, @hasAlbumArt, @hasStems, @hasLyrics,
          @songLength, @previewStart, @chorusId, @folderHash, @lastScanned
        )
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          artist = excluded.artist,
          album = excluded.album,
          genre = excluded.genre,
          year = excluded.year,
          charter = excluded.charter,
          diff_guitar = excluded.diff_guitar,
          diff_bass = excluded.diff_bass,
          diff_drums = excluded.diff_drums,
          diff_keys = excluded.diff_keys,
          diff_vocals = excluded.diff_vocals,
          diff_rhythm = excluded.diff_rhythm,
          diff_guitarghl = excluded.diff_guitarghl,
          diff_bassghl = excluded.diff_bassghl,
          hasGuitar = excluded.hasGuitar,
          hasBass = excluded.hasBass,
          hasDrums = excluded.hasDrums,
          hasKeys = excluded.hasKeys,
          hasVocals = excluded.hasVocals,
          hasRhythm = excluded.hasRhythm,
          hasGHL = excluded.hasGHL,
          guitarDiffs = excluded.guitarDiffs,
          bassDiffs = excluded.bassDiffs,
          drumsDiffs = excluded.drumsDiffs,
          keysDiffs = excluded.keysDiffs,
          vocalsDiffs = excluded.vocalsDiffs,
          rhythmDiffs = excluded.rhythmDiffs,
          ghlGuitarDiffs = excluded.ghlGuitarDiffs,
          ghlBassDiffs = excluded.ghlBassDiffs,
          chartType = excluded.chartType,
          hasVideo = excluded.hasVideo,
          hasBackground = excluded.hasBackground,
          hasAlbumArt = excluded.hasAlbumArt,
          hasStems = excluded.hasStems,
          hasLyrics = excluded.hasLyrics,
          songLength = excluded.songLength,
          previewStart = excluded.previewStart,
          chorusId = excluded.chorusId,
          folderHash = excluded.folderHash,
          lastScanned = excluded.lastScanned
      `)
			this.stmtCache.set(cacheKey, stmt)
		}

		const result = stmt.run(this.chartToDbParams(chart))
		return result.lastInsertRowid as number
	}

	getCharts(filter: CatalogFilter = {}): ChartRecord[] {
		const { whereClause, params } = this.buildFilterClauses(filter)

		// Build base query (FTS search changes the structure)
		let query: string
		if (filter.search) {
			query = `
        SELECT charts.* FROM charts
        INNER JOIN charts_fts ON charts.id = charts_fts.rowid
        WHERE charts_fts MATCH @search${whereClause}
      `
		} else {
			query = `SELECT * FROM charts WHERE 1=1${whereClause}`
		}

		// Sorting
		const sortCol = filter.sortBy || 'artist'
		const sortDir = filter.sortDirection || 'asc'
		const validColumns = ['name', 'artist', 'album', 'charter', 'year', 'lastScanned', 'chartType']
		if (validColumns.includes(sortCol)) {
			query += ` ORDER BY ${sortCol} COLLATE NOCASE ${sortDir === 'desc' ? 'DESC' : 'ASC'}`
		}

		// Pagination
		if (filter.limit) {
			query += ' LIMIT @limit'
			params.limit = filter.limit
		}
		if (filter.offset) {
			query += ' OFFSET @offset'
			params.offset = filter.offset
		}

		const stmt = this.db.prepare(query)
		const rows = stmt.all(params) as Record<string, unknown>[]

		return rows.map(row => this.rowToChartRecord(row))
	}

	getChart(id: number): ChartRecord | null {
		const stmt = this.db.prepare('SELECT * FROM charts WHERE id = ?')
		const row = stmt.get(id) as Record<string, unknown> | undefined
		if (!row) return null
		return this.rowToChartRecord(row)
	}

	getChartByPath(chartPath: string): ChartRecord | null {
		const stmt = this.db.prepare('SELECT * FROM charts WHERE path = ?')
		const row = stmt.get(chartPath) as Record<string, unknown> | undefined
		if (!row) return null
		return this.rowToChartRecord(row)
	}

	/**
	 * Check if charts exist in library by artist, name, and charter
	 * Returns a map of "artist|name|charter" -> boolean
	 *
	 * Uses a temp table join for efficient bulk checking instead of loading all charts
	 */
	checkChartsExist(charts: Array<{ artist: string; name: string; charter: string }>): Map<string, boolean> {
		const result = new Map<string, boolean>()

		if (charts.length === 0) return result

		// Normalize function for comparison
		const normalize = (s: string) => s.toLowerCase().trim()

		// Initialize all keys as not found
		charts.forEach(c => {
			const key = `${normalize(c.artist)}|${normalize(c.name)}|${normalize(c.charter)}`
			result.set(key, false)
		})

		// Use a transaction with temp table for efficient bulk checking
		const checkCharts = this.db.transaction(() => {
			// Create temp table for the search keys
			this.db.exec(`
				CREATE TEMP TABLE IF NOT EXISTS temp_chart_lookup (
					artist TEXT,
					name TEXT,
					charter TEXT
				)
			`)
			this.db.exec('DELETE FROM temp_chart_lookup')

			// Insert search keys into temp table
			const insertStmt = this.db.prepare(
				'INSERT INTO temp_chart_lookup (artist, name, charter) VALUES (?, ?, ?)'
			)
			for (const chart of charts) {
				insertStmt.run(normalize(chart.artist), normalize(chart.name), normalize(chart.charter))
			}

			// Join against charts table to find matches (case-insensitive)
			const matches = this.db.prepare(`
				SELECT LOWER(TRIM(c.artist)) as artist, LOWER(TRIM(c.name)) as name, LOWER(TRIM(c.charter)) as charter
				FROM charts c
				INNER JOIN temp_chart_lookup t
					ON LOWER(TRIM(c.artist)) = t.artist
					AND LOWER(TRIM(c.name)) = t.name
					AND LOWER(TRIM(c.charter)) = t.charter
			`).all() as Array<{ artist: string; name: string; charter: string }>

			// Mark found charts as existing
			for (const match of matches) {
				const key = `${match.artist || ''}|${match.name || ''}|${match.charter || ''}`
				result.set(key, true)
			}

			// Clean up temp table
			this.db.exec('DELETE FROM temp_chart_lookup')
		})

		checkCharts()
		return result
	}

	private rowToChartRecord(row: Record<string, unknown>): ChartRecord {
		return {
			id: row.id as number,
			path: row.path as string,
			name: row.name as string,
			artist: row.artist as string,
			album: row.album as string,
			genre: row.genre as string,
			year: row.year as number | null,
			charter: row.charter as string,
			diff_guitar: row.diff_guitar as number | null,
			diff_bass: row.diff_bass as number | null,
			diff_drums: row.diff_drums as number | null,
			diff_keys: row.diff_keys as number | null,
			diff_vocals: row.diff_vocals as number | null,
			diff_rhythm: row.diff_rhythm as number | null,
			diff_guitarghl: row.diff_guitarghl as number | null,
			diff_bassghl: row.diff_bassghl as number | null,
			hasGuitar: Boolean(row.hasGuitar),
			hasBass: Boolean(row.hasBass),
			hasDrums: Boolean(row.hasDrums),
			hasKeys: Boolean(row.hasKeys),
			hasVocals: Boolean(row.hasVocals),
			hasRhythm: Boolean(row.hasRhythm),
			hasGHL: Boolean(row.hasGHL),
			guitarDiffs: (row.guitarDiffs as string) || '',
			bassDiffs: (row.bassDiffs as string) || '',
			drumsDiffs: (row.drumsDiffs as string) || '',
			keysDiffs: (row.keysDiffs as string) || '',
			vocalsDiffs: (row.vocalsDiffs as string) || '',
			rhythmDiffs: (row.rhythmDiffs as string) || '',
			ghlGuitarDiffs: (row.ghlGuitarDiffs as string) || '',
			ghlBassDiffs: (row.ghlBassDiffs as string) || '',
			chartType: row.chartType as 'mid' | 'chart' | 'sng' | null,
			hasVideo: Boolean(row.hasVideo),
			hasBackground: Boolean(row.hasBackground),
			hasAlbumArt: Boolean(row.hasAlbumArt),
			hasStems: Boolean(row.hasStems),
			hasLyrics: Boolean(row.hasLyrics),
			songLength: row.songLength as number | null,
			previewStart: row.previewStart as number | null,
			chorusId: row.chorusId as string | null,
			folderHash: row.folderHash as string,
			lastScanned: row.lastScanned as string,
		}
	}

	deleteChart(id: number): boolean {
		const stmt = this.db.prepare('DELETE FROM charts WHERE id = ?')
		const result = stmt.run(id)
		return result.changes > 0
	}

	/**
	 * Delete charts that are no longer in valid paths
	 * Uses batch deletes in a transaction for efficiency
	 */
	deleteOrphans(validPaths: Set<string>): number {
		const allCharts = this.db.prepare('SELECT id, path FROM charts').all() as Array<{ id: number; path: string }>

		// Collect IDs to delete
		const idsToDelete: number[] = []
		for (const chart of allCharts) {
			if (!validPaths.has(chart.path)) {
				idsToDelete.push(chart.id)
			}
		}

		if (idsToDelete.length === 0) return 0

		// Batch delete in transaction for efficiency
		// SQLite has a limit on compound query size, so we chunk into batches of 500
		const BATCH_SIZE = 500
		const deleteInBatches = this.db.transaction(() => {
			for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
				const batch = idsToDelete.slice(i, i + BATCH_SIZE)
				const placeholders = batch.map(() => '?').join(',')
				this.db.prepare(`DELETE FROM charts WHERE id IN (${placeholders})`).run(...batch)
			}
		})

		deleteInBatches()
		return idsToDelete.length
	}

	getStats(): CatalogStats {
		const stats = this.db.prepare(`
      SELECT
        COUNT(*) as totalCharts,
        SUM(hasVideo) as withVideo,
        SUM(hasBackground) as withBackground,
        SUM(hasAlbumArt) as withAlbumArt,
        SUM(hasLyrics) as withLyrics,
        COUNT(DISTINCT artist) as uniqueArtists,
        COUNT(DISTINCT charter) as uniqueCharters
      FROM charts
    `).get() as Record<string, number>

		return {
			totalCharts: stats.totalCharts || 0,
			withVideo: stats.withVideo || 0,
			withBackground: stats.withBackground || 0,
			withAlbumArt: stats.withAlbumArt || 0,
			withLyrics: stats.withLyrics || 0,
			uniqueArtists: stats.uniqueArtists || 0,
			uniqueCharters: stats.uniqueCharters || 0,
		}
	}

	/**
	 * Get count of charts matching the filter (for pagination)
	 * Does not apply limit/offset
	 */
	getChartsCount(filter: CatalogFilter = {}): number {
		const { whereClause, params } = this.buildFilterClauses(filter)

		// Build base query (FTS search changes the structure)
		let query: string
		if (filter.search) {
			query = `
        SELECT COUNT(*) as count FROM charts
        INNER JOIN charts_fts ON charts.id = charts_fts.rowid
        WHERE charts_fts MATCH @search${whereClause}
      `
		} else {
			query = `SELECT COUNT(*) as count FROM charts WHERE 1=1${whereClause}`
		}

		const stmt = this.db.prepare(query)
		const result = stmt.get(params) as { count: number }
		return result.count
	}

	getAllPaths(): Set<string> {
		const rows = this.db.prepare('SELECT path FROM charts').all() as Array<{ path: string }>
		return new Set(rows.map(r => r.path))
	}

	/**
	 * Get all paths and their folder hashes for incremental scanning
	 * Returns a map of path -> folderHash
	 */
	getAllHashes(): Map<string, string> {
		const rows = this.db.prepare('SELECT path, folderHash FROM charts').all() as Array<{ path: string; folderHash: string }>
		return new Map(rows.map(r => [r.path, r.folderHash || '']))
	}

	/**
	 * Update the lastScanned timestamp for a chart without rescanning
	 * Used for unchanged charts during incremental scans
	 */
	touchChart(chartPath: string): void {
		const cacheKey = 'touchChart'
		let stmt = this.stmtCache.get(cacheKey)
		if (!stmt) {
			stmt = this.db.prepare('UPDATE charts SET lastScanned = ? WHERE path = ?')
			this.stmtCache.set(cacheKey, stmt)
		}
		stmt.run(new Date().toISOString(), chartPath)
	}

	/**
	 * Batch touch multiple chart paths in a single transaction
	 * Much more efficient than calling touchChart multiple times
	 */
	touchChartsBatch(chartPaths: string[]): void {
		if (chartPaths.length === 0) return

		const cacheKey = 'touchChart'
		let stmt = this.stmtCache.get(cacheKey)
		if (!stmt) {
			stmt = this.db.prepare('UPDATE charts SET lastScanned = ? WHERE path = ?')
			this.stmtCache.set(cacheKey, stmt)
		}

		const timestamp = new Date().toISOString()
		const batchTouch = this.db.transaction(() => {
			for (const chartPath of chartPaths) {
				stmt!.run(timestamp, chartPath)
			}
		})
		batchTouch()
	}

	/**
	 * Batch upsert multiple charts in a single transaction
	 * Much more efficient than calling upsertChart multiple times
	 */
	upsertChartsBatch(charts: Array<Omit<ChartRecord, 'id'>>): number[] {
		if (charts.length === 0) return []

		const cacheKey = 'upsertChart'
		let stmt = this.stmtCache.get(cacheKey)

		if (!stmt) {
			stmt = this.db.prepare(`
        INSERT INTO charts (
          path, name, artist, album, genre, year, charter,
          diff_guitar, diff_bass, diff_drums, diff_keys, diff_vocals,
          diff_rhythm, diff_guitarghl, diff_bassghl,
          hasGuitar, hasBass, hasDrums, hasKeys, hasVocals, hasRhythm, hasGHL,
          guitarDiffs, bassDiffs, drumsDiffs, keysDiffs, vocalsDiffs, rhythmDiffs, ghlGuitarDiffs, ghlBassDiffs,
          chartType,
          hasVideo, hasBackground, hasAlbumArt, hasStems, hasLyrics,
          songLength, previewStart, chorusId, folderHash, lastScanned
        ) VALUES (
          @path, @name, @artist, @album, @genre, @year, @charter,
          @diff_guitar, @diff_bass, @diff_drums, @diff_keys, @diff_vocals,
          @diff_rhythm, @diff_guitarghl, @diff_bassghl,
          @hasGuitar, @hasBass, @hasDrums, @hasKeys, @hasVocals, @hasRhythm, @hasGHL,
          @guitarDiffs, @bassDiffs, @drumsDiffs, @keysDiffs, @vocalsDiffs, @rhythmDiffs, @ghlGuitarDiffs, @ghlBassDiffs,
          @chartType,
          @hasVideo, @hasBackground, @hasAlbumArt, @hasStems, @hasLyrics,
          @songLength, @previewStart, @chorusId, @folderHash, @lastScanned
        )
        ON CONFLICT(path) DO UPDATE SET
          name = excluded.name,
          artist = excluded.artist,
          album = excluded.album,
          genre = excluded.genre,
          year = excluded.year,
          charter = excluded.charter,
          diff_guitar = excluded.diff_guitar,
          diff_bass = excluded.diff_bass,
          diff_drums = excluded.diff_drums,
          diff_keys = excluded.diff_keys,
          diff_vocals = excluded.diff_vocals,
          diff_rhythm = excluded.diff_rhythm,
          diff_guitarghl = excluded.diff_guitarghl,
          diff_bassghl = excluded.diff_bassghl,
          hasGuitar = excluded.hasGuitar,
          hasBass = excluded.hasBass,
          hasDrums = excluded.hasDrums,
          hasKeys = excluded.hasKeys,
          hasVocals = excluded.hasVocals,
          hasRhythm = excluded.hasRhythm,
          hasGHL = excluded.hasGHL,
          guitarDiffs = excluded.guitarDiffs,
          bassDiffs = excluded.bassDiffs,
          drumsDiffs = excluded.drumsDiffs,
          keysDiffs = excluded.keysDiffs,
          vocalsDiffs = excluded.vocalsDiffs,
          rhythmDiffs = excluded.rhythmDiffs,
          ghlGuitarDiffs = excluded.ghlGuitarDiffs,
          ghlBassDiffs = excluded.ghlBassDiffs,
          chartType = excluded.chartType,
          hasVideo = excluded.hasVideo,
          hasBackground = excluded.hasBackground,
          hasAlbumArt = excluded.hasAlbumArt,
          hasStems = excluded.hasStems,
          hasLyrics = excluded.hasLyrics,
          songLength = excluded.songLength,
          previewStart = excluded.previewStart,
          chorusId = excluded.chorusId,
          folderHash = excluded.folderHash,
          lastScanned = excluded.lastScanned
      `)
			this.stmtCache.set(cacheKey, stmt)
		}

		const ids: number[] = []
		const batchUpsert = this.db.transaction(() => {
			for (const chart of charts) {
				const result = stmt!.run(this.chartToDbParams(chart))
				ids.push(result.lastInsertRowid as number)
			}
		})
		batchUpsert()
		return ids
	}

	/**
	 * Run a function within a database transaction
	 * Useful for external code that needs to batch multiple operations
	 */
	runInTransaction<T>(fn: () => T): T {
		return this.db.transaction(fn)()
	}

	getDistinctValues(column: 'artist' | 'charter' | 'genre' | 'album'): string[] {
		const validColumns = ['artist', 'charter', 'genre', 'album']
		if (!validColumns.includes(column)) return []

		const rows = this.db.prepare(`
      SELECT DISTINCT ${column} FROM charts
      WHERE ${column} IS NOT NULL AND ${column} != ''
      ORDER BY ${column} COLLATE NOCASE
    `).all() as Array<Record<string, string>>

		return rows.map(r => r[column])
	}

	/**
	 * Update the video status for a chart
	 * Used by Video Sync module after downloading
	 */
	updateChartVideoStatus(chartId: number, hasVideo: boolean): void {
		const stmt = this.db.prepare('UPDATE charts SET hasVideo = ? WHERE id = ?')
		stmt.run(hasVideo ? 1 : 0, chartId)
	}

	/**
	 * Update the background status for a chart
	 */
	updateChartBackgroundStatus(chartId: number, hasBackground: boolean): void {
		const stmt = this.db.prepare('UPDATE charts SET hasBackground = ? WHERE id = ?')
		stmt.run(hasBackground ? 1 : 0, chartId)
	}

	/**
	 * Update the album art status for a chart
	 */
	updateChartAlbumArtStatus(chartId: number, hasAlbumArt: boolean): void {
		const stmt = this.db.prepare('UPDATE charts SET hasAlbumArt = ? WHERE id = ?')
		stmt.run(hasAlbumArt ? 1 : 0, chartId)
	}

	/**
	 * Update the lyrics status for a chart
	 */
	updateChartLyricsStatus(chartId: number, hasLyrics: boolean): void {
		const stmt = this.db.prepare('UPDATE charts SET hasLyrics = ? WHERE id = ?')
		stmt.run(hasLyrics ? 1 : 0, chartId)
	}

	getSetting(key: string): string | null {
		const row = this.db.prepare('SELECT value FROM catalog_settings WHERE key = ?').get(key) as { value: string } | undefined
		return row?.value ?? null
	}

	setSetting(key: string, value: string): void {
		this.db.prepare('INSERT OR REPLACE INTO catalog_settings (key, value) VALUES (?, ?)').run(key, value)
	}

	close(): void {
		this.db.close()
	}
}

// Singleton instance
let instance: CatalogDatabase | null = null

export function getCatalogDb(): CatalogDatabase {
	if (!instance) {
		instance = new CatalogDatabase()
	}
	return instance
}
