import type { CategoryKey, EditorKey } from "./types";

export const PROJECT_CATEGORIES: Array<{ id: CategoryKey; label: string }> = [
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
  { id: "miniprogram", label: "小程序" },
  { id: "web", label: "Web" },
  { id: "desktop", label: "桌面" },
  { id: "backend", label: "后端" },
  { id: "cli", label: "CLI" },
  { id: "library", label: "库" },
  { id: "other", label: "其他" },
];

export const EDITOR_PRESETS: Array<{ key: EditorKey; label: string }> = [
  { key: "code", label: "VS Code" },
  { key: "cursor", label: "Cursor" },
  { key: "webstorm", label: "WebStorm" },
  { key: "zed", label: "Zed" },
  { key: "android_studio", label: "Android Studio" },
  { key: "xcode", label: "Xcode" },
  { key: "wechat_devtools", label: "微信开发者工具" },
];

export function categoryLabel(category: CategoryKey) {
  return PROJECT_CATEGORIES.find((item) => item.id === category)?.label ?? "其他";
}

export function editorLabel(editorKey: string) {
  return EDITOR_PRESETS.find((editor) => editor.key === editorKey)?.label ?? editorKey;
}
