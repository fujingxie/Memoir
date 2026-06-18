import { invoke, isTauri as tauriIsTauri } from "@tauri-apps/api/core";
import type {
  ArchiveKey,
  ArchiveState,
  CategoryKey,
  ChatLinkKind,
  ChatSource,
  CommitInfo,
  EditorKey,
  FileNode,
  GitInfo,
  LanguageKey,
  Project,
  ProjectStatus,
  SortKey,
  ProjectChatLink,
  ProjectChatDetail,
} from "./types";

type VcsType = "git" | "none";

interface BackendProject {
  id: number;
  name: string;
  path: string;
  vcs_type: VcsType;
  remote_url: string | null;
  last_commit_at: string | null;
  last_opened_at: string | null;
  archive_completeness: number;
  category: string;
  status: ProjectStatus;
  created_at: string;
  tags: string[];
  language: string;
  archive_positioning: string;
  tech_stack: string[];
  last_commit_msg: string | null;
  last_commit_hash: string | null;
  docs_count: number;
}

export interface ScanProjectsResult {
  scanned_roots: number;
  discovered: number;
  inserted: number;
  skipped: number;
  projects: Project[];
}

interface BackendFileNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: BackendFileNode[];
}

export interface ProjectFilePreview {
  kind: "text" | "binary" | "too_large" | "unavailable";
  text: string | null;
  message: string | null;
}

interface BackendGitStatus {
  tracked: boolean;
  branch: string;
  remote_url: string | null;
  ahead: number;
  behind: number;
  dirty: boolean;
  changes: number;
  files: GitChangedFile[];
}

interface BackendGitCommit {
  hash: string;
  full_hash: string;
  message: string;
  author: string;
  date: string;
  additions: number;
  deletions: number;
}

interface BackendGitCommandResult {
  message: string;
}

interface BackendGitHubPublishResult {
  message: string;
  remote_url: string;
  html_url: string;
  branch: string;
}

interface BackendGitDiff {
  files: GitDiffFile[];
  additions: number;
  deletions: number;
}

interface BackendArchiveRecord {
  sections: Record<ArchiveKey, string>;
  completeness: number;
  md_path: string;
}

interface BackendArchiveAiDraft {
  sections: Record<ArchiveKey, string>;
  markdown: string;
  source_files: string[];
}

interface BackendDocument {
  id: number;
  project_id: number;
  type: "local_file" | "local_dir" | "link";
  title: string;
  path_or_url: string;
  created_at: string;
}

interface BackendChatLink {
  id: number;
  project_id: number;
  source: ChatSource;
  kind: ChatLinkKind;
  url_or_file: string;
  title: string;
  summary: string | null;
  captured_at: string;
}

interface BackendChatLinkDetail extends BackendChatLink {
  content: string;
  truncated: boolean;
}

export interface GitChangedFile {
  path: string;
  status: string;
}

export interface PersistedGitStatus {
  git: GitInfo;
  files: GitChangedFile[];
}

export interface GitDiffLine {
  kind: "add" | "del" | "ctx" | "meta";
  content: string;
}

export interface GitDiffFile {
  path: string;
  additions: number;
  deletions: number;
  lines: GitDiffLine[];
}

export interface GitDiff {
  files: GitDiffFile[];
  additions: number;
  deletions: number;
}

export interface GitHubPublishInput {
  token?: string;
  repoName: string;
  private: boolean;
  description?: string;
  branch?: string;
  commitMessage?: string;
}

export interface GitHubPublishResult {
  message: string;
  remoteUrl: string;
  htmlUrl: string;
  branch: string;
}

export interface PersistedArchiveRecord {
  archive: ArchiveState;
  completeness: number;
  mdPath: string;
}

export interface DeepSeekKeyStatus {
  configured: boolean;
  masked: string | null;
}

export interface GitHubTokenStatus {
  configured: boolean;
  masked: string | null;
}

export interface ArchiveAiDraft {
  archive: ArchiveState;
  markdown: string;
  sourceFiles: string[];
}

export interface DocumentInput {
  type: "local_file" | "local_dir" | "link";
  title?: string;
  pathOrUrl: string;
}

export interface ChatLinkInput {
  source: ChatSource;
  kind: ChatLinkKind;
  urlOrFile: string;
  title?: string;
  summary?: string;
}

export interface ChatImportCandidate {
  source: ChatSource;
  kind: "import";
  urlOrFile: string;
  title: string;
  summary?: string | null;
  capturedAt?: string | null;
}

export interface AppSettings {
  scan_roots: string[];
  editor_cmd: string;
  category_editors: Partial<Record<CategoryKey, EditorKey>>;
  theme: "dark" | "light";
}

type TauriWindow = Window &
  typeof globalThis & {
    __TAURI_INTERNALS__?: unknown;
  };

export function isTauriRuntime(): boolean {
  return tauriIsTauri() || Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export async function listPersistedProjects(options?: {
  status?: ProjectStatus | "all";
  search?: string;
  sort?: SortKey;
}): Promise<Project[] | null> {
  if (!isTauriRuntime()) return null;

  const projects = await invoke<BackendProject[]>("list_projects", {
    filter: {
      status: options?.status ?? "all",
      search: options?.search ?? "",
    },
    sort: options?.sort ?? "opened",
  });
  return projects.map(mapBackendProject);
}

export async function scanPersistedProjects(root: string): Promise<ScanProjectsResult | null> {
  if (!isTauriRuntime()) return null;

  const result = await invoke<Omit<ScanProjectsResult, "projects"> & { projects: BackendProject[] }>(
    "scan_projects",
    { roots: [root] },
  );

  return {
    ...result,
    projects: result.projects.map(mapBackendProject),
  };
}

export async function addPersistedProject(path: string): Promise<Project | null> {
  if (!isTauriRuntime()) return null;

  const project = await invoke<BackendProject>("add_project", { path });
  return mapBackendProject(project);
}

export async function getPersistedProject(id: string): Promise<Project | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const project = await invoke<BackendProject>("get_project", { id: projectId });
  return mapBackendProject(project);
}

export async function setPersistedProjectCategory(
  id: string,
  category: CategoryKey,
): Promise<Project | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const project = await invoke<BackendProject>("set_project_category", {
    id: projectId,
    category,
  });
  return mapBackendProject(project);
}

export async function getPersistedFileTree(id: string, depth?: number): Promise<FileNode | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const args: { id: number; depth?: number } = { id: projectId };
  if (depth !== undefined) args.depth = depth;
  const tree = await invoke<BackendFileNode>("get_file_tree", args);
  return mapBackendFileNode(tree);
}

export async function readPersistedProjectFile(
  id: string,
  relativePath: string,
): Promise<ProjectFilePreview | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  return invoke<ProjectFilePreview>("read_project_file", {
    id: projectId,
    path: relativePath,
  });
}

export async function getPersistedGitStatus(id: string): Promise<PersistedGitStatus | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const status = await invoke<BackendGitStatus>("git_status", { id: projectId });
  return {
    git: mapBackendGitStatus(status),
    files: status.files,
  };
}

export async function getPersistedGitLog(id: string, limit = 20): Promise<CommitInfo[] | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const commits = await invoke<BackendGitCommit[]>("git_log", { id: projectId, limit });
  return commits.map(mapBackendGitCommit);
}

export async function initPersistedGit(path: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const result = await invoke<BackendGitCommandResult>("git_init", { path });
  return result.message;
}

export async function setPersistedGitRemote(id: string, url: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  const result = await invoke<BackendGitCommandResult>("git_set_remote", {
    id: projectId,
    url,
  });
  return result.message;
}

export async function publishPersistedGitHubRepo(
  id: string,
  input: GitHubPublishInput,
): Promise<GitHubPublishResult | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  const result = await invoke<BackendGitHubPublishResult>("git_publish_to_github", {
    id: projectId,
    input: {
      token: input.token ?? null,
      repo_name: input.repoName,
      private: input.private,
      description: input.description,
      branch: input.branch,
      commit_message: input.commitMessage,
    },
  });
  return {
    message: result.message,
    remoteUrl: result.remote_url,
    htmlUrl: result.html_url,
    branch: result.branch,
  };
}

export async function commitPersistedGit(
  id: string,
  message: string,
  files: string[],
): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  const result = await invoke<BackendGitCommandResult>("git_commit", {
    id: projectId,
    message,
    files,
  });
  return result.message;
}

export async function pushPersistedGit(id: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  const result = await invoke<BackendGitCommandResult>("git_push", { id: projectId });
  return result.message;
}

export async function pullPersistedGit(id: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  const result = await invoke<BackendGitCommandResult>("git_pull", { id: projectId });
  return result.message;
}

export async function getPersistedGitDiff(options: {
  id: string;
  file?: string | null;
  commit?: string | null;
}): Promise<GitDiff | null> {
  const projectId = persistedProjectId(options.id);
  if (!isTauriRuntime() || projectId === null) return null;
  const diff = await invoke<BackendGitDiff>("git_diff", {
    id: projectId,
    file: options.file ?? null,
    commit: options.commit ?? null,
  });
  return diff;
}

export async function readPersistedArchive(id: string): Promise<PersistedArchiveRecord | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const record = await invoke<BackendArchiveRecord>("read_archive", { id: projectId });
  return mapBackendArchive(record);
}

export async function savePersistedArchive(
  id: string,
  archive: ArchiveState,
): Promise<PersistedArchiveRecord | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const record = await invoke<BackendArchiveRecord>("save_archive", {
    id: projectId,
    sections: archiveSectionsPayload(archive),
  });
  return mapBackendArchive(record);
}

export async function getDeepSeekKeyStatus(): Promise<DeepSeekKeyStatus | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DeepSeekKeyStatus>("get_deepseek_key_status");
}

export async function saveDeepSeekApiKey(key: string): Promise<DeepSeekKeyStatus | null> {
  if (!isTauriRuntime()) return null;
  return invoke<DeepSeekKeyStatus>("save_deepseek_api_key", { key });
}

export async function getGitHubTokenStatus(): Promise<GitHubTokenStatus | null> {
  if (!isTauriRuntime()) return null;
  return invoke<GitHubTokenStatus>("get_github_token_status");
}

export async function saveGitHubToken(token: string): Promise<GitHubTokenStatus | null> {
  if (!isTauriRuntime()) return null;
  return invoke<GitHubTokenStatus>("save_github_token", { token });
}

export async function generateArchiveAi(id: string): Promise<ArchiveAiDraft | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const draft = await invoke<BackendArchiveAiDraft>("generate_archive_ai", { id: projectId });
  return {
    archive: mapArchiveSections(draft.sections),
    markdown: draft.markdown,
    sourceFiles: draft.source_files,
  };
}

export async function listPersistedDocuments(id: string): Promise<Project["docs"] | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const docs = await invoke<BackendDocument[]>("list_documents", { id: projectId });
  return docs.map(mapBackendDocument);
}

export async function addPersistedDocument(
  id: string,
  document: DocumentInput,
): Promise<Project["docs"][number] | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const doc = await invoke<BackendDocument>("add_document", {
    id: projectId,
    document,
  });
  return mapBackendDocument(doc);
}

export async function deletePersistedDocument(id: string, documentId: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  const docId = persistedProjectId(documentId);
  if (!isTauriRuntime() || projectId === null || docId === null) return null;

  return invoke<string>("delete_document", {
    id: projectId,
    documentId: docId,
  });
}

export async function openPersistedDocument(id: string, documentId: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  const docId = persistedProjectId(documentId);
  if (!isTauriRuntime() || projectId === null || docId === null) return null;

  return invoke<string>("open_document", {
    id: projectId,
    documentId: docId,
  });
}

export async function listPersistedChatLinks(id: string): Promise<ProjectChatLink[] | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const links = await invoke<BackendChatLink[]>("list_chat_links", { id: projectId });
  return links.map(mapBackendChatLink);
}

export async function addPersistedChatLink(
  id: string,
  link: ChatLinkInput,
): Promise<ProjectChatLink | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;

  const record = await invoke<BackendChatLink>("add_chat_link", {
    id: projectId,
    link,
  });
  return mapBackendChatLink(record);
}

export async function deletePersistedChatLink(id: string, chatId: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  const parsedChatId = persistedProjectId(chatId);
  if (!isTauriRuntime() || projectId === null || parsedChatId === null) return null;

  return invoke<string>("delete_chat_link", {
    id: projectId,
    chatId: parsedChatId,
  });
}

export async function openPersistedChatLink(id: string, chatId: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  const parsedChatId = persistedProjectId(chatId);
  if (!isTauriRuntime() || projectId === null || parsedChatId === null) return null;

  return invoke<string>("open_chat_link", {
    id: projectId,
    chatId: parsedChatId,
  });
}

export async function readPersistedChatLinkDetail(
  id: string,
  chatId: string,
): Promise<ProjectChatDetail | null> {
  const projectId = persistedProjectId(id);
  const parsedChatId = persistedProjectId(chatId);
  if (!isTauriRuntime() || projectId === null || parsedChatId === null) return null;

  const detail = await invoke<BackendChatLinkDetail>("read_chat_link_detail", {
    id: projectId,
    chatId: parsedChatId,
  });
  return mapBackendChatDetail(detail);
}

export async function importPersistedChatExport(file: string): Promise<ChatImportCandidate[] | null> {
  if (!isTauriRuntime()) return null;

  const candidates = await invoke<
    Array<{
      source: ChatSource;
      kind: "import";
      url_or_file: string;
      title: string;
      summary: string | null;
      captured_at: string | null;
    }>
  >("import_chat_export", { file });

  return candidates.map((candidate) => ({
    source: candidate.source,
    kind: candidate.kind,
    urlOrFile: candidate.url_or_file,
    title: candidate.title,
    summary: candidate.summary,
    capturedAt: candidate.captured_at,
  }));
}

export async function scanPersistedLocalChatExports(
  source: Extract<ChatSource, "codex" | "claude_code">,
  limit = 30,
): Promise<ChatImportCandidate[] | null> {
  if (!isTauriRuntime()) return null;

  const candidates = await invoke<
    Array<{
      source: ChatSource;
      kind: "import";
      url_or_file: string;
      title: string;
      summary: string | null;
      captured_at: string | null;
    }>
  >("scan_local_chat_exports", { input: { source, limit } });

  return candidates.map((candidate) => ({
    source: candidate.source,
    kind: candidate.kind,
    urlOrFile: candidate.url_or_file,
    title: candidate.title,
    summary: candidate.summary,
    capturedAt: candidate.captured_at,
  }));
}

export async function getAppSettings(): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("get_app_settings");
}

export async function pickPersistedDirectory(initialPath: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>("pick_directory", { initialPath });
}

export async function pickPersistedFile(initialPath: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>("pick_file", { initialPath });
}

export async function addPersistedScanRoot(root: string): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("add_scan_root", { root });
}

export async function removePersistedScanRoot(root: string): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("remove_scan_root", { root });
}

export async function setPersistedEditorCommand(editorCmd: string): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("set_editor_cmd", { editorCmd });
}

export async function setPersistedCategoryEditor(
  category: CategoryKey,
  editorKey: EditorKey | "",
): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("set_category_editor", { category, editorKey });
}

export async function setPersistedThemeSetting(theme: AppSettings["theme"]): Promise<AppSettings | null> {
  if (!isTauriRuntime()) return null;
  return invoke<AppSettings>("set_theme_setting", { theme });
}

export async function openPersistedProjectDir(id: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  return invoke<string>("open_project_dir", { id: projectId });
}

export async function openPersistedProjectEditor(id: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  return invoke<string>("open_project_editor", { id: projectId });
}

export async function openPersistedProjectTerminal(id: string): Promise<string | null> {
  const projectId = persistedProjectId(id);
  if (!isTauriRuntime() || projectId === null) return null;
  return invoke<string>("open_project_terminal", { id: projectId });
}

export function canUsePersistedProject(project: Project): boolean {
  return isTauriRuntime() && persistedProjectId(project.id) !== null;
}

function mapBackendProject(project: BackendProject): Project {
  const language = normalizeLanguage(project.language);
  const isGit = project.vcs_type === "git";
  const tags = project.tags.length > 0 ? project.tags : [language, isGit ? "git" : "local"];

  return {
    id: String(project.id),
    name: project.name,
    path: project.path,
    lang: language,
    category: normalizeCategory(project.category),
    description: project.archive_positioning.trim(),
    lastOpened: formatTimeLabel(project.last_opened_at ?? project.created_at),
    lastCommit: project.last_commit_at ? formatTimeLabel(project.last_commit_at) : "从未",
    lastOpenedAt: project.last_opened_at,
    lastCommitAt: project.last_commit_at,
    createdAt: project.created_at,
    lastCommitMsg: project.last_commit_msg ?? "",
    lastCommitHash: project.last_commit_hash ?? "",
    git: {
      tracked: isGit,
      state: "clean",
      changes: 0,
      ahead: 0,
      behind: 0,
      branch: "",
      remote: project.remote_url ?? "",
    },
    status: project.status,
    tags: tags.filter((tag) => tag !== "unknown"),
    techStack: project.tech_stack ?? [],
    commits: [],
    files: { name: project.name, type: "folder", children: [] },
    archive: {
      positioning: { filled: false, text: "" },
      tech: { filled: false, text: "" },
      deploy: { filled: false, text: "" },
      todos: { filled: false, text: "" },
    },
    archiveCompleteness: project.archive_completeness,
    docs: [],
    docsCount: project.docs_count,
  };
}

function mapBackendFileNode(node: BackendFileNode): FileNode {
  return {
    name: node.name,
    path: node.path,
    type: node.type,
    children: node.children?.map(mapBackendFileNode),
  };
}

function mapBackendGitStatus(status: BackendGitStatus): GitInfo {
  return {
    tracked: status.tracked,
    state: status.dirty ? "dirty" : "clean",
    changes: status.changes,
    ahead: status.ahead,
    behind: status.behind,
    branch: status.branch,
    remote: status.remote_url ?? "",
  };
}

function mapBackendGitCommit(commit: BackendGitCommit): CommitInfo {
  return {
    hash: commit.hash,
    msg: commit.message,
    time: formatTimeLabel(commit.date),
    add: commit.additions,
    del: commit.deletions,
    author: commit.author,
  };
}

function mapBackendDocument(doc: BackendDocument): Project["docs"][number] {
  const type = doc.type === "local_file" ? "file" : doc.type === "local_dir" ? "folder" : "link";
  return {
    id: String(doc.id),
    type,
    name: doc.title,
    meta: documentMeta(type, doc.path_or_url),
    pathOrUrl: doc.path_or_url,
    createdAt: doc.created_at,
  };
}

function mapBackendChatLink(link: BackendChatLink): ProjectChatLink {
  return {
    id: String(link.id),
    source: link.source,
    kind: link.kind,
    title: link.title,
    summary: link.summary,
    urlOrFile: link.url_or_file,
    capturedAt: link.captured_at,
  };
}

function mapBackendChatDetail(link: BackendChatLinkDetail): ProjectChatDetail {
  return {
    ...mapBackendChatLink(link),
    content: link.content,
    truncated: link.truncated,
  };
}

function documentMeta(type: Project["docs"][number]["type"], pathOrUrl: string): string {
  if (type === "link") {
    return pathOrUrl.replace(/^https?:\/\//i, "").split("/")[0] || pathOrUrl;
  }
  return pathOrUrl;
}

const ARCHIVE_KEYS: ArchiveKey[] = ["positioning", "tech", "deploy", "todos"];

function mapBackendArchive(record: BackendArchiveRecord): PersistedArchiveRecord {
  return {
    archive: mapArchiveSections(record.sections),
    completeness: record.completeness,
    mdPath: record.md_path,
  };
}

function mapArchiveSections(sections: Partial<Record<ArchiveKey, string>>): ArchiveState {
  return ARCHIVE_KEYS.reduce<ArchiveState>((acc, key) => {
    const text = sections[key] ?? "";
    acc[key] = { filled: text.trim().length > 0, text };
    return acc;
  }, {} as ArchiveState);
}

function archiveSectionsPayload(archive: ArchiveState): Record<ArchiveKey, string> {
  return ARCHIVE_KEYS.reduce<Record<ArchiveKey, string>>(
    (acc, key) => {
      acc[key] = archive[key]?.text ?? "";
      return acc;
    },
    { positioning: "", tech: "", deploy: "", todos: "" },
  );
}

function persistedProjectId(id: string): number | null {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return numericId;
}

function normalizeLanguage(language: string): LanguageKey {
  const supported = new Set<LanguageKey>([
    "ts",
    "js",
    "rust",
    "python",
    "go",
    "csharp",
    "shell",
    "unknown",
  ]);
  return supported.has(language as LanguageKey) ? (language as LanguageKey) : "unknown";
}

function normalizeCategory(category: string): CategoryKey {
  const supported = new Set<CategoryKey>([
    "android",
    "ios",
    "miniprogram",
    "web",
    "desktop",
    "backend",
    "cli",
    "library",
    "other",
  ]);
  return supported.has(category as CategoryKey) ? (category as CategoryKey) : "other";
}

function formatTimeLabel(value: string | null): string {
  if (!value) return "从未";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const time = new Date(normalized).getTime();
  if (Number.isNaN(time)) return value;

  const diffMs = Date.now() - time;
  if (diffMs < 60_000) return "刚刚";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} 小时前`;
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)} 天前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(time));
}
