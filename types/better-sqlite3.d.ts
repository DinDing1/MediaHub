/**
 * better-sqlite3 类型声明
 */
declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      pragma(source: string): unknown
      prepare(sql: string): Statement
      exec(sql: string): void
      close(): void
    }

    interface Statement {
      get(...params: unknown[]): unknown
      all(...params: unknown[]): unknown[]
      run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint }
    }
  }

  interface DatabaseConstructor {
    new (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean }): Database.Database
    (filename: string, options?: { readonly?: boolean; fileMustExist?: boolean }): Database.Database
  }

  const Database: DatabaseConstructor
  export = Database
}
