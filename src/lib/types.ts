export type Theme = "dark" | "light";
export type Route = "overview" | "detail" | "settings";
export type DetailTab = "overview" | "files" | "git" | "archive" | "docs";
export type ProjectStatus = "active" | "archived";
export type SortKey = "opened" | "commit" | "completeness" | "name";
export type ViewMode = "grid" | "list";
export type GitState = "clean" | "dirty";
export type ArchiveKey = "positioning" | "tech" | "deploy" | "todos";
export type LanguageKey = "ts" | "js" | "rust" | "python" | "go" | "csharp" | "shell";

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
  type: "folder" | "file";
  children?: FileNode[];
}

export interface ArchiveSection {
  filled: boolean;
  text: string;
}

export type ArchiveState = Record<ArchiveKey, ArchiveSection>;

export interface ProjectDocument {
  type: "file" | "link";
  name: string;
  meta: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lang: LanguageKey;
  pinned?: boolean;
  description: string;
  lastOpened: string;
  lastCommit: string;
  lastCommitMsg: string;
  lastCommitHash: string;
  git: GitInfo;
  status: ProjectStatus;
  tags: string[];
  techStack: string[];
  commits: CommitInfo[];
  files: FileNode;
  archive: ArchiveState;
  docs: ProjectDocument[];
}

export interface ToastState {
  msg: string;
  type: "success" | "warning" | "error" | "info";
}

export interface DiffState {
  open: boolean;
  commit: CommitInfo | null;
  mode: "commit" | "working";
}
