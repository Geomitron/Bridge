import { Connection, createConnection } from 'mysql'
import { failQuery } from './ErrorMessages'

export default class Database {

  // Singleton
  private static database: Database
  private constructor() { }
  static async getInstance() {
    if (this.database == undefined) {
      this.database = new Database()
      await this.database.initDatabaseConnection()
    }
    return this.database
  }

  private conn: Connection

  /**
  * Constructs a database connection to the chartmanager database.
  */
  private async initDatabaseConnection() {
    this.conn = createConnection({
      host: 'chartmanager.cdtrqnlcxz86.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: 'standarduser',
      password: 'E4OZXWDPiX9exUpMhcQq', // Note: this login is read-only
      database: 'chartmanagerdatabase',
      multipleStatements: true,
      charset: 'utf8mb4',
      typeCast: (field, next) => { // Convert 1/0 to true/false
        if (field.type == 'TINY' && field.length == 1) {
          return (field.string() == '1') // 1 = true, 0 = false
        } else {
          return next()
        }
      }
    })

    // TODO: make this error message more user-friendly (retry option?)
    return new Promise<void>((resolve, reject) => {
      this.conn.connect(err => {
        if (err) {
          reject(`Failed to connect to database: ${err}`)
          return
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Destroys the database connection.
   */
  static closeConnection() {
    if (this.database != undefined) {
      this.database.conn.destroy()
    }
  }

  /**
   * Sends `query` to the database.
   * @param queryStatement The nth response statement to be returned. If undefined, the entire response is returned.
   * @returns the selected response statement, or an empty array if the query fails.
   */
  async sendQuery<ResponseType>(query: string, queryStatement?: number) {
    return new Promise<ResponseType[] | ResponseType>(resolve => {
      this.conn.query(query, (err, results) => {
        if (err) {
          failQuery(query, err)
          resolve([])
          return
        }
        if (queryStatement !== undefined) {
          resolve(results[queryStatement - 1])
        } else {
          resolve(results)
        }
      })
    })
  }
}