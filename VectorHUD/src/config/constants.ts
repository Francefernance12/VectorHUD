export const API_ENDPOINTS = {
  OPEN_ROUTER_CHAT: "https://openrouter.ai/api/v1/chat/completions",
  NOTION_SEARCH: "https://api.notion.com/v1/search",
  NOTION_PAGES: "https://api.notion.com/v1/pages",
  NOTION_BLOCKS: (blockId: string) => `https://api.notion.com/v1/blocks/${blockId}/children`,
  NOTION_BLOCK: (blockId: string) => `https://api.notion.com/v1/blocks/${blockId}`,
};

export const API_HEADERS = {
  NOTION_VERSION: "2022-06-28",
};

export const UI_CONSTANTS = {
  CHAT_SYSTEM_PROMPT: "You are VectorHUD, a helpful overlay assistant for a gamer. Be extremely concise, formatted, and tactical in your answers.",
};
