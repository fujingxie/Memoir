import Database from "@tauri-apps/plugin-sql";
import { isTauriRuntime } from "./projects-api";

export const MEMOIR_DB_URL = "sqlite:memoir.db";

export async function initMemoirDatabase(): Promise<string> {
  if (!isTauriRuntime()) {
    return "浏览器预览模式";
  }

  try {
    const db = await Database.load(MEMOIR_DB_URL);
    const tables = await db.select<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );

    return `数据库已初始化 · ${tables.length} tables`;
  } catch (error) {
    console.log("[DEBUG][initMemoirDatabase]", { error }, new Date().toISOString());
    throw new Error(error instanceof Error ? error.message : "数据库初始化失败");
  }
}
