export type Theme = "dark" | "light";
export type Route = "overview" | "detail" | "settings";
export type DetailTab = "overview" | "files" | "git" | "archive" | "docs";
export type ProjectStatus = "active" | "archived";
export type SortKey = "opened" | "commit" | "completeness" | "name";
export type CategoryKey =
  | "android"
  | "ios"
  | "miniprogram"
  | "web"
  | "desktop"
  | "backend"
  | "cli"
  | "library"
  | "other";
export type EditorKey =
  | "code"
  | "cursor"
  | "webstorm"
  | "zed"
  | "android_studio"
  | "xcode"
  | "wechat_devtools";
export type FocusKey =
  | "needsArchive"
  | "dirty"
  | "noGithubRemote"
  | "nonGit"
  | "stale"
  | "noDocs";
export type ViewMode = "grid" | "list";
export type GitState = "clean" | "dirty";
export type ArchiveKey = "positioning" | "tech" | "deploy" | "todos";
export type LanguageKey =
  | "ts"
  | "js"
  | "rust"
  | "python"
  | "go"
  | "csharp"
  | "shell"
  | "unknown";

export interface LanguageMeta {
  label: string;
  color: string;
}

export interface GitInfo {
  tracked: boolean;
  state: GitState;
  changes: number;
  ahead: number;
  behind: number;
  branch: string;
  remote: string;
}

export interface CommitInfo {
  hash: string;
  msg: string;
  time: string;
  add: number;
  del: number;
  author: string;
}

export interface FileNode {
  name: string;
  path?: string;
  type: "folder" | "file";
  children?: FileNode[];
}

export interface ArchiveSection {
  filled: boolean;
  text: string;
}

export type ArchiveState = Record<ArchiveKey, ArchiveSection>;

export interface ProjectDocument {
  id?: string;
  type: "file" | "folder" | "link";
  name: string;
  meta: string;
  pathOrUrl?: string;
  createdAt?: string | null;
}

export type ChatSource = "claude" | "chatgpt" | "claude_code" | "codex";
export type ChatLinkKind = "link" | "import";

export interface ProjectChatLink {
  id?: string;
  source: ChatSource;
  kind: ChatLinkKind;
  title: string;
  summary?: string | null;
  urlOrFile: string;
  capturedAt?: string | null;
}

export interface ProjectChatDetail extends ProjectChatLink {
  content: string;
  truncated: boolean;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lang: LanguageKey;
  category: CategoryKey;
  pinned?: boolean;
  description: string;
  lastOpened: string;
  lastCommit: string;
  lastOpenedAt?: string | null;
  lastCommitAt?: string | null;
  createdAt?: string | null;
  lastCommitMsg: string;
  lastCommitHash: string;
  git: GitInfo;
  status: ProjectStatus;
  tags: string[];
  techStack: string[];
  commits: CommitInfo[];
  files: FileNode;
  archive: ArchiveState;
  archiveCompleteness?: number;
  docs: ProjectDocument[];
  docsCount?: number;
}

export interface ToastState {
  msg: string;
  type: "success" | "warning" | "error" | "info";
}

export interface DiffState {
  open: boolean;
  commit: CommitInfo | null;
  mode: "commit" | "working";
  file?: string | null;
}
