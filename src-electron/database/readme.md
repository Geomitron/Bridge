## Migrations
In order to create a new migration, there is a some steps to go through.

1. Run ``npm run migration:add --name <migration name>`` This currently work for Windows machines. If using Linux or Mac run this instead ``npx typeorm-ts-node-esm migration:generate ./src-electron/database/migrations/<migration name> -d ./src-electron/database/dataSource.ts``

2. Go to ``./src-electron/database/dataSource.ts`` and add the newly 
generated migration to the migrations array and entity variables. In that way it will automatically apply the latest changes to the database on startup.

## The database
A Sqlite database file is automatically created on startup named Library, it will be placed in the same directory as the executable.
