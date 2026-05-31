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
    logger.info("SQLite database loaded successfully");
    return dbInstance;
  } catch (error) {
    logger.error(`Failed to load SQLite database: ${error}`);
    throw error;
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
