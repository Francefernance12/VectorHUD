import { Store } from "@tauri-apps/plugin-store";
import { logger } from "./logger";

// Initialize the store lazily. settings.json will be saved in AppData.
let settingsStore: Store | null = null;

export async function getSettingsStore(): Promise<Store> {
  if (settingsStore) return settingsStore;
  try {
    settingsStore = await Store.load("settings.json");
    logger.info("Settings store loaded successfully");
    return settingsStore;
  } catch (error) {
    logger.error(`Failed to load settings store: ${error}`);
    throw error;
  }
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const store = await getSettingsStore();
  const val = await store.get<T>(key);
  return (val ?? defaultValue) as T;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const store = await getSettingsStore();
  await store.set(key, value);
  await store.save();
}
