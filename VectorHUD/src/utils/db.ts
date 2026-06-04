import Database from "@tauri-apps/plugin-sql";
import { logger } from "./logger";

let dbInstance: Database | null = null;

/**
 * Initializes and returns the SQLite database connection.
 * The database file `vectorhud.db` is stored in the AppData directory.
 */
export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  try {
    dbInstance = await Database.load("sqlite:vectorhud.db");
    
    // Validate DB is truly responsive
    await dbInstance.execute("SELECT 1");

    // Validate that schema migrations executed successfully
    const tables = await dbInstance.select<{name: string}[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('capture_history', 'user_credentials', 'widget_analytics')"
    );

    if (tables.length !== 3) {
      throw new Error(`Schema validation failed. Expected 3 core tables, found ${tables.length}. The database migrations may not have run.`);
    }
    
    logger.info("SQLite database loaded and schema verified").catch(console.error);
    return dbInstance;
  } catch (error) {
    console.error("FATAL: Database initialization failed", error);
    logger.error(`Failed to load SQLite database: ${error}`).catch(console.error);
    throw new Error("VectorHUD cannot initialize the database. " + (error instanceof Error ? error.message : "Please check your file permissions."));
  }
}

/**
 * Helper to execute a query safely and log errors.
 */
export async function executeQuery(query: string, bindValues?: unknown[]) {
  const db = await getDb();
  try {
    return await db.execute(query, bindValues);
  } catch (error) {
    logger.error(`Query execution failed: ${error}`);
    throw error;
  }
}
