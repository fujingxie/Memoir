import { useEffect, useState } from "react";
import { AppIcon, type IconName } from "../components/AppIcon";
import {
  Button,
  CompletenessRing,
  EmptyState,
  GitBadge,
  IconButton,
  LangDot,
  StatusBadge,
  TagChip,
} from "../components/Primitives";
import { PROJECT_CATEGORIES } from "../lib/categories";
import { archiveFilledCount, computeCompleteness } from "../lib/completeness";
import {
  addPersistedChatLink,
  addPersistedDocument,
  canUsePersistedProject,
  commitPersistedGit,
  deletePersistedChatLink,
  deletePersistedDocument,
  getPersistedFileTree,
  getPersistedGitLog,
  getPersistedGitStatus,
  importPersistedChatExport,
  initPersistedGit,
  listPersistedChatLinks,
  listPersistedDocuments,
  openPersistedChatLink,
  openPersistedProjectDir,
  openPersistedProjectEditor,
  openPersistedProjectTerminal,
  openPersistedDocument,
  pickPersistedDirectory,
  pickPersistedFile,
  pullPersistedGit,
  publishPersistedGitHubRepo,
  pushPersistedGit,
  readPersistedChatLinkDetail,
  readPersistedProjectFile,
  scanPersistedLocalChatExports,
  setPersistedGitRemote,
} from "../lib/projects-api";
import type { ChatImportCandidate, ChatLinkInput, DocumentInput, GitChangedFile } from "../lib/projects-api";
import type {
  ArchiveKey,
  ArchiveState,
  CategoryKey,
  CommitInfo,
  DetailTab,
  FileNode,
  GitInfo,
  Project,
  ProjectChatDetail,
  ProjectChatLink,
  ProjectDocument,
} from "../lib/types";

const TABS: Array<{ id: DetailTab; label: string; icon: IconName }> = [
  { id: "overview", label: "概览", icon: "layers" },
  { id: "files", label: "文件结构", icon: "folder" },
  { id: "git", label: "Git", icon: "gitBranch" },
  { id: "archive", label: "项目档案", icon: "bookOpen" },
  { id: "docs", label: "资料", icon: "link" },
];

const ARCHIVE_META: Record<ArchiveKey, { title: string; icon: IconName; placeholder: string }> = {
  positioning: {
    title: "项目定位",
    icon: "tag",
    placeholder: "这个项目是什么,解决什么问题,谁会在几年后接手它。",
  },
  tech: {
    title: "技术栈与设计",
    icon: "package",
    placeholder: "关键技术栈、架构取舍、重要设计约束。",
  },
  deploy: {
    title: "运行部署运维",
    icon: "terminal",
    placeholder: "如何启动、构建、部署,以及常见运维注意点。",
  },
  todos: {
    title: "待办与已知问题",
    icon: "inbox",
    placeholder: "未完成事项、历史坑点、需要后来者留意的问题。",
  },
};

function defaultGithubRepoName(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "memoir-project";
}

interface ProjectDetailProps {
  project: Project;
  archive: ArchiveState;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onOpenDiff: (commit: CommitInfo | null, mode?: "commit" | "working") => void;
  onOpenAI: () => void;
  onCategoryChange: (category: CategoryKey) => void;
  onSaveArchive: (key: ArchiveKey, text: string) => void;
}

export function ProjectDetail({
  project,
  archive,
  tab,
  onTab,
  onToast,
  onOpenDiff,
  onOpenAI,
  onCategoryChange,
  onSaveArchive,
}: ProjectDetailProps) {
  const completeness = computeCompleteness(project, archive);
  const filled = archiveFilledCount(archive);
  const archiveIncomplete = filled < 4;
  const openInEditor = async () => {
    try {
      const message = await openPersistedProjectEditor(project.id);
      onToast(message ?? `已用默认编辑器打开 ${project.name}`, "success");
    } catch (error) {
      console.log("[DEBUG][ProjectDetail.openInEditor]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "编辑器打开失败", "error");
    }
  };
  const openDirectory = async () => {
    try {
      const message = await openPersistedProjectDir(project.id);
      onToast(message ?? `已打开 ${project.path}`, "success");
    } catch (error) {
      console.log("[DEBUG][ProjectDetail.openDirectory]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "打开目录失败", "error");
    }
  };
  const openTerminal = async () => {
    try {
      const message = await openPersistedProjectTerminal(project.id);
      onToast(message ?? `已打开 ${project.name} 的终端`, "success");
    } catch (error) {
      console.log("[DEBUG][ProjectDetail.openTerminal]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "打开终端失败", "error");
    }
  };

  return (
    <section className="detail-shell">
      <header className="project-header">
        <div className="flex min-w-0 items-center gap-4">
          <CompletenessRing value={completeness} size={56} stroke={5} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <LangDot lang={project.lang} />
              <h1 className="truncate text-[23px] font-bold leading-tight text-[var(--text-primary)]">
                {project.name}
              </h1>
              <label className="category-select">
                <select
                  aria-label="项目分类"
                  value={project.category}
                  onChange={(event) => onCategoryChange(event.target.value as CategoryKey)}
                >
                  {PROJECT_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <StatusBadge status={project.status} />
            </div>
            <div className="mono mt-1 flex min-w-0 items-center gap-2 truncate text-[12.5px] text-[var(--text-tertiary)]">
              <span className="truncate">{project.path}</span>
              <span>·</span>
              <LangDot lang={project.lang} showLabel />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => void openInEditor()}>
            <AppIcon name="code" size={15} />
            编辑器
          </Button>
          <Button variant="secondary" onClick={() => void openTerminal()}>
            <AppIcon name="terminal" size={15} />
            终端
          </Button>
          <Button variant="primary" onClick={() => void openDirectory()}>
            <AppIcon name="folderOpen" size={15} />
            打开目录
          </Button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={`tab-button ${tab === item.id ? "active" : ""}`}
            onClick={() => onTab(item.id)}
          >
            <AppIcon name={item.icon} size={15} />
            {item.label}
            {item.id === "archive" && archiveIncomplete ? <span className="tab-dot" /> : null}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <OverviewTab
          project={project}
          archive={archive}
          completeness={completeness}
          onTab={onTab}
          onOpenAI={onOpenAI}
        />
      ) : null}
      {tab === "files" ? <FilesTab project={project} onToast={onToast} /> : null}
      {tab === "git" ? (
        <GitTab project={project} onOpenDiff={onOpenDiff} onToast={onToast} />
      ) : null}
      {tab === "archive" ? (
        <ArchiveTab
          project={project}
          archive={archive}
          onOpenAI={onOpenAI}
          onSaveArchive={onSaveArchive}
        />
      ) : null}
      {tab === "docs" ? <DocsTab project={project} onToast={onToast} /> : null}
    </section>
  );
}

function OverviewTab({
  project,
  archive,
  completeness,
  onTab,
  onOpenAI,
}: {
  project: Project;
  archive: ArchiveState;
  completeness: number;
  onTab: (tab: DetailTab) => void;
  onOpenAI: () => void;
}) {
  const filled = archiveFilledCount(archive);
  const missing = (Object.keys(archive) as ArchiveKey[]).filter((key) => !archive[key].filled);
  const recentActivityTitle = project.git.tracked
    ? project.lastCommitMsg || "暂无提交"
    : "最近打开";
  const recentActivityMeta = project.git.tracked
    ? `${project.lastCommitHash || "no-commit"} · ${project.lastCommit}`
    : project.lastOpened;

  return (
    <div className="tab-content space-y-5">
      <div className="panel pad panel-row">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <AppIcon name="bookOpen" size={16} />
            档案摘要
          </div>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
            {archive.positioning.filled
              ? archive.positioning.text
              : "还没有项目定位。建议先用 AI 生成一份初稿,再手动校对。"}
          </p>
        </div>
        <Button variant="ghost" onClick={() => onTab("archive")}>
          查看完整档案
          <AppIcon name="chevronR" size={14} />
        </Button>
      </div>

      <div className="info-grid">
        <div className="panel pad">
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <AppIcon name="package" size={14} />
            技术栈
          </div>
          <div className="chip-row">
            {project.techStack.length > 0 ? (
              project.techStack.map((item) => <TagChip key={item}>{item}</TagChip>)
            ) : (
              <span className="text-[13px] text-[var(--text-tertiary)]">暂未识别</span>
            )}
          </div>
        </div>

        <div className="panel pad">
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <AppIcon name="gitCommit" size={14} />
            最近活动
          </div>
          <div className="truncate text-[13.5px] font-medium">{recentActivityTitle}</div>
          <div className="mono mt-2 text-xs text-[var(--text-tertiary)]">{recentActivityMeta}</div>
        </div>

        <div className="panel pad flex items-center gap-4">
          <CompletenessRing value={completeness} size={52} />
          <div>
            <div className="text-[13.5px] font-medium">完整度</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">已填 {filled} / 4 个档案分区</div>
          </div>
        </div>
      </div>

      {missing.length > 0 ? (
        <div className="warn-strip">
          <AppIcon name="alert" size={22} color="var(--warning)" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">还有 {missing.length} 个档案分区待补全</div>
            <div className="mt-1 text-[13px] text-[var(--text-secondary)]">
              补全后,这个项目即使放上一年也能秒懂。
            </div>
            <div className="chip-row mt-2">
              {missing.map((key) => (
                <TagChip key={key}>{ARCHIVE_META[key].title}</TagChip>
              ))}
            </div>
          </div>
          <Button variant="primary" onClick={onOpenAI}>
            <AppIcon name="sparkles" size={15} />
            AI 补全
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function FilesTab({
  project,
  onToast,
}: {
  project: Project;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  const persisted = canUsePersistedProject(project);
  const [tree, setTree] = useState(project.files);
  const [selected, setSelected] = useState(findFirstFile(project.files) ?? "");
  const [treeMessage, setTreeMessage] = useState<string | null>(null);
  const [codeLines, setCodeLines] = useState<string[]>(() =>
    previewCode(findFirstFile(project.files) ?? "README.md", project),
  );
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    const firstFile = findFirstFile(project.files) ?? "";
    setTree(project.files);
    setSelected(firstFile);
    setTreeMessage(null);
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    if (!persisted) return;

    setTreeMessage("正在读取文件树...");
    void getPersistedFileTree(project.id, 5)
      .then((nextTree) => {
        if (cancelled || !nextTree) return;
        const firstFile = findFirstFile(nextTree) ?? "";
        setTree(nextTree);
        setSelected(firstFile);
        setTreeMessage(firstFile ? null : "这个项目暂时没有可预览的文件");
      })
      .catch((error) => {
        if (cancelled) return;
        console.log("[DEBUG][FilesTab.loadTree]", { error }, new Date().toISOString());
        setTreeMessage("文件树读取失败");
        onToast("文件树读取失败", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [persisted, project.id, onToast]);

  useEffect(() => {
    let cancelled = false;
    if (!selected) {
      setCodeLines([]);
      setLoadingPreview(false);
      setPreviewMessage("选择左侧文件进行预览");
      return () => {
        cancelled = true;
      };
    }

    if (!persisted) {
      setCodeLines(previewCode(selected, project));
      setLoadingPreview(false);
      setPreviewMessage(null);
      return () => {
        cancelled = true;
      };
    }

    setLoadingPreview(true);
    setCodeLines([]);
    setPreviewMessage("正在读取文件...");
    void readPersistedProjectFile(project.id, selected)
      .then((preview) => {
        if (cancelled) return;
        setLoadingPreview(false);
        if (!preview) {
          setPreviewMessage("当前环境不可读取文件");
          return;
        }
        if (preview.kind === "text") {
          setCodeLines((preview.text ?? "").split(/\r?\n/));
          setPreviewMessage(null);
          return;
        }
        setPreviewMessage(preview.message ?? "这个文件不可预览");
      })
      .catch((error) => {
        if (cancelled) return;
        console.log("[DEBUG][FilesTab.loadPreview]", { error, selected }, new Date().toISOString());
        setLoadingPreview(false);
        setPreviewMessage("文件读取失败");
        onToast("文件读取失败", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [persisted, project, project.id, selected, onToast]);

  return (
    <div className="tab-content">
      <div className="split-pane">
        <div className="tree-pane">
          {treeMessage ? (
            <div className="mb-2 rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--text-tertiary)]">
              {treeMessage}
            </div>
          ) : null}
          <FileTree node={tree} selected={selected} onSelect={setSelected} />
        </div>
        <div className="code-pane">
          <div className="panel-row border-b border-[var(--border)] px-4 py-3">
            <div className="mono flex min-w-0 items-center gap-2 truncate text-[12.5px]">
              <AppIcon name="fileCode" size={15} color="var(--accent)" />
              {selected || "未选择文件"}
            </div>
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--text-tertiary)]">
              只读
            </span>
          </div>
          <div className="code-body mono">
            {previewMessage ? (
              <div className="code-placeholder">
                <AppIcon name={loadingPreview ? "clock" : "file"} size={18} />
                <span>{previewMessage}</span>
              </div>
            ) : (
              codeLines.map((line, index) => (
                <div className="code-line" key={`${selected}-${index}`}>
                  <span>{index + 1}</span>
                  <span>{line || " "}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FileTree({
  node,
  selected,
  onSelect,
  level = 0,
}: {
  node: FileNode;
  selected: string;
  onSelect: (name: string) => void;
  level?: number;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.type === "folder";
  const nodePath = node.path ?? node.name;
  const active = !isFolder && selected === nodePath;

  return (
    <div>
      <button
        className="focus-ring flex h-7 w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-[12.5px] transition hover:bg-[var(--surface-hover)]"
        style={{ paddingLeft: 8 + level * 14, color: active ? "var(--primary)" : "var(--text-secondary)" }}
        onClick={() => (isFolder ? setOpen(!open) : onSelect(nodePath))}
      >
        {isFolder ? (
          <AppIcon name={open ? "folderOpen" : "folder"} size={14} color="var(--accent)" />
        ) : (
          <AppIcon name="file" size={14} />
        )}
        <span className="mono truncate">{node.name}</span>
      </button>
      {isFolder && open
        ? node.children?.map((child) => (
            <FileTree
              key={child.path ?? `${nodePath}-${child.name}`}
              node={child}
              selected={selected}
              onSelect={onSelect}
              level={level + 1}
            />
          ))
        : null}
    </div>
  );
}

function GitTab({
  project,
  onOpenDiff,
  onToast,
}: {
  project: Project;
  onOpenDiff: (commit: CommitInfo | null, mode?: "commit" | "working", file?: string | null) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  const persisted = canUsePersistedProject(project);
  const [git, setGit] = useState<GitInfo>(project.git);
  const [commits, setCommits] = useState<CommitInfo[]>(project.commits);
  const [changedFiles, setChangedFiles] = useState<GitChangedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [gitMessage, setGitMessage] = useState<string | null>(null);
  const [remoteDraft, setRemoteDraft] = useState(project.git.remote);
  const [githubRepoName, setGithubRepoName] = useState(defaultGithubRepoName(project.name));
  const [githubToken, setGithubToken] = useState("");
  const [githubPrivate, setGithubPrivate] = useState(true);
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubCommitMessage, setGithubCommitMessage] = useState("Initial commit");
  const [commitOpen, setCommitOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    const nextFiles = persisted ? [] : mockChangedFiles(project);
    setGit(project.git);
    setCommits(project.commits);
    setChangedFiles(nextFiles);
    setSelectedFiles(nextFiles.map((file) => file.path));
    setGitMessage(null);
    setRemoteDraft(project.git.remote);
    setGithubRepoName(defaultGithubRepoName(project.name));
    setGithubToken("");
    setGithubPrivate(true);
    setGithubBranch("main");
    setGithubCommitMessage("Initial commit");
  }, [persisted, project]);

  const refreshGit = async () => {
    if (!persisted) return;
    setLoading(true);
    setGitMessage("正在读取 Git 状态...");
    try {
      const [nextStatus, nextCommits] = await Promise.all([
        getPersistedGitStatus(project.id),
        getPersistedGitLog(project.id, 20),
      ]);
      if (nextStatus) {
        setGit(nextStatus.git);
        setChangedFiles(nextStatus.files);
        setSelectedFiles(nextStatus.files.map((file) => file.path));
        setRemoteDraft(nextStatus.git.remote);
      }
      if (nextCommits) setCommits(nextCommits);
      setGitMessage(null);
    } catch (error) {
      console.log("[DEBUG][GitTab.loadGit]", { error }, new Date().toISOString());
      setGitMessage("Git 状态读取失败");
      onToast("Git 状态读取失败", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!persisted) return;
    void refreshGit();
  }, [persisted, project.id]);

  const runInit = async () => {
    if (!persisted) {
      onToast("Git 初始化将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("init");
    try {
      const message = await initPersistedGit(project.path);
      if (remoteDraft.trim()) {
        await setPersistedGitRemote(project.id, remoteDraft.trim());
      }
      await refreshGit();
      onToast(message ?? "Git 仓库已初始化", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runInit]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "Git 初始化失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const runSetRemote = async () => {
    if (!remoteDraft.trim()) {
      onToast("请输入远程仓库地址", "warning");
      return;
    }
    if (!persisted) {
      onToast("远程设置将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("remote");
    try {
      const message = await setPersistedGitRemote(project.id, remoteDraft.trim());
      await refreshGit();
      onToast(message ?? "远程仓库已更新", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runSetRemote]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "远程仓库更新失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const runPublishGitHub = async () => {
    if (!githubRepoName.trim()) {
      onToast("请输入 GitHub 仓库名", "warning");
      return;
    }
    if (!persisted) {
      onToast("GitHub 发布将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("github");
    try {
      const result = await publishPersistedGitHubRepo(project.id, {
        token: githubToken.trim() || undefined,
        repoName: githubRepoName.trim(),
        private: githubPrivate,
        branch: githubBranch.trim() || "main",
        commitMessage: githubCommitMessage.trim() || "Initial commit",
        description: project.description || undefined,
      });
      setGithubToken("");
      await refreshGit();
      onToast(result?.message ?? "GitHub 仓库已创建并推送", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runPublishGitHub]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "GitHub 发布失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const runCommit = async () => {
    if (!commitMessage.trim()) {
      onToast("请输入提交信息", "warning");
      return;
    }
    if (selectedFiles.length === 0) {
      onToast("请选择至少一个文件", "warning");
      return;
    }
    if (!persisted) {
      onToast("Commit 将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("commit");
    try {
      await commitPersistedGit(project.id, commitMessage.trim(), selectedFiles);
      setCommitOpen(false);
      setCommitMessage("");
      await refreshGit();
      onToast("提交成功", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runCommit]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "提交失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const runPush = async () => {
    if (!persisted) {
      onToast("Push 将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("push");
    try {
      const message = await pushPersistedGit(project.id);
      await refreshGit();
      onToast(message ?? "Push 完成", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runPush]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "Push 失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const runPull = async () => {
    if (!persisted) {
      onToast("Pull 将在 Tauri runtime 中执行", "info");
      return;
    }
    setWorking("pull");
    try {
      const message = await pullPersistedGit(project.id);
      await refreshGit();
      onToast(message ?? "Pull 完成", "success");
    } catch (error) {
      console.log("[DEBUG][GitTab.runPull]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "Pull 失败", "error");
    } finally {
      setWorking(null);
    }
  };

  const toggleCommitFile = (path: string) => {
    setSelectedFiles((files) =>
      files.includes(path) ? files.filter((file) => file !== path) : [...files, path],
    );
  };

  if (loading && gitMessage) {
    return (
      <div className="tab-content">
        <div className="code-placeholder panel">
          <AppIcon name="clock" size={18} />
          <span>{gitMessage}</span>
        </div>
      </div>
    );
  }

  if (!git.tracked) {
    return (
      <div className="tab-content">
        <EmptyState
          icon="gitBranch"
          title="这个项目还不是 Git 仓库"
          body="初始化后, Memoir 就能读取分支、提交历史和工作区状态。"
          action={
            <div className="w-[min(680px,calc(100vw-96px))] space-y-4 text-left">
              <pre className="mono rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-xs text-[var(--text-secondary)]">
                git init && git add -A
              </pre>
              <div className="flex gap-2">
                <input
                  value={remoteDraft}
                  onChange={(event) => setRemoteDraft(event.target.value)}
                  placeholder="可选: git@github.com:user/repo.git"
                  className="focus-ring mono h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
                />
                <Button variant="primary" disabled={working !== null} onClick={runInit}>
                  {working === "init" ? "初始化中..." : "初始化 Git 仓库"}
                </Button>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                <div className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-[var(--text-primary)]">
                  <AppIcon name="globe" size={15} />
                  发布到 GitHub
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] text-[var(--text-tertiary)]">
                      仓库名
                    </span>
                    <input
                      value={githubRepoName}
                      onChange={(event) => setGithubRepoName(event.target.value)}
                      placeholder="memoir-project"
                      className="focus-ring mono h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] text-[var(--text-tertiary)]">
                      分支
                    </span>
                    <input
                      value={githubBranch}
                      onChange={(event) => setGithubBranch(event.target.value)}
                      placeholder="main"
                      className="focus-ring mono h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-[11px] text-[var(--text-tertiary)]">
                      GitHub Token
                    </span>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(event) => setGithubToken(event.target.value)}
                      placeholder="已在设置页保存则可留空"
                      className="focus-ring mono h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-[11px] text-[var(--text-tertiary)]">
                      首次提交
                    </span>
                    <input
                      value={githubCommitMessage}
                      onChange={(event) => setGithubCommitMessage(event.target.value)}
                      placeholder="Initial commit"
                      className="focus-ring h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={githubPrivate}
                      onChange={(event) => setGithubPrivate(event.target.checked)}
                    />
                    私有仓库
                  </label>
                  <Button variant="primary" disabled={working !== null} onClick={runPublishGitHub}>
                    <AppIcon name="arrowUp" size={15} />
                    {working === "github" ? "上传中..." : "创建并上传"}
                  </Button>
                </div>
              </div>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="tab-content space-y-5">
      <div className="panel pad panel-row">
        <div className="flex min-w-0 items-center gap-8">
          <GitMeta label="当前分支" value={git.branch || "未提交"} icon="gitBranch" />
          <GitMeta label="远程" value={git.remote || "未设置"} icon="globe" />
          <GitMeta label="同步" value={`ahead ${git.ahead} · behind ${git.behind}`} icon="gitCommit" />
          <div>
            <div className="mb-2 text-[11px] text-[var(--text-tertiary)]">状态</div>
            <GitBadge git={git} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={working === "pull"} onClick={runPull}>
            <AppIcon name="arrowDown" size={15} />
            {working === "pull" ? "Pulling..." : "Pull"}
          </Button>
          <Button variant="secondary" disabled={working === "push"} onClick={runPush}>
            <AppIcon name="arrowUp" size={15} />
            {working === "push" ? "Pushing..." : "Push"}
          </Button>
          <Button
            variant="primary"
            disabled={changedFiles.length === 0}
            onClick={() => setCommitOpen(true)}
          >
            <AppIcon name="gitCommit" size={15} />
            Commit
          </Button>
        </div>
      </div>

      {gitMessage ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          {gitMessage}
        </div>
      ) : null}

      <div className="panel pad panel-row">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs text-[var(--text-tertiary)]">远程</span>
          <input
            value={remoteDraft}
            onChange={(event) => setRemoteDraft(event.target.value)}
            placeholder="git@github.com:user/repo.git"
            className="focus-ring mono h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs text-[var(--text-primary)] outline-none"
          />
        </label>
        <Button variant="secondary" disabled={working === "remote"} onClick={runSetRemote}>
          保存远程
        </Button>
      </div>

      {git.state === "dirty" ? (
        <button className="warn-strip w-full text-left" onClick={() => onOpenDiff(commits[0] ?? null, "working")}>
          <AppIcon name="alert" size={20} color="var(--warning)" />
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">有 {git.changes} 处未提交改动</div>
            <div className="text-xs text-[var(--text-secondary)]">点击查看工作区 Diff</div>
          </div>
          <AppIcon name="chevronR" size={16} />
        </button>
      ) : null}

      {changedFiles.length > 0 ? (
        <div>
          <div className="section-label mb-3">工作区文件 · {changedFiles.length}</div>
          <div className="panel overflow-hidden">
            {changedFiles.map((file) => (
              <button
                key={`${file.status}-${file.path}`}
                className="history-row flex w-full items-center gap-3 border-0 border-b border-[var(--border)] bg-transparent px-4 py-2.5 text-left last:border-b-0"
                onClick={() => onOpenDiff(null, "working", file.path)}
              >
                <span className="mono h-5 min-w-8 rounded-md bg-[var(--surface-elevated)] px-2 text-center text-[11px] text-[var(--text-tertiary)]">
                  {file.status}
                </span>
                <span className="mono min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-secondary)]">
                  {file.path}
                </span>
                <AppIcon name="chevronR" size={15} color="var(--text-tertiary)" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="section-label mb-3">提交历史 · {commits.length}</div>
        <div className="panel overflow-hidden">
          {commits.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--text-tertiary)]">
              暂无提交历史
            </div>
          ) : null}
          {commits.map((commit) => (
            <button
              key={commit.hash}
              className="history-row flex w-full items-center gap-4 border-0 border-b border-[var(--border)] bg-transparent px-4 py-3 text-left last:border-b-0"
              onClick={() => onOpenDiff(commit, "commit")}
            >
              <span className="h-3 w-3 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-soft)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{commit.msg}</span>
                <span className="mono mt-1 block text-xs text-[var(--text-tertiary)]">
                  {commit.hash} · {commit.author} · {commit.time}
                </span>
              </span>
              <span className="mono text-xs text-[var(--diff-add-text)]">+{commit.add}</span>
              <span className="mono text-xs text-[var(--diff-del-text)]">-{commit.del}</span>
              <AppIcon name="chevronR" size={15} color="var(--text-tertiary)" />
            </button>
          ))}
        </div>
      </div>

      {commitOpen ? (
        <div className="modal-backdrop" onClick={() => setCommitOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="panel-row border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold">提交改动</h2>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  选择要纳入本次 commit 的文件
                </div>
              </div>
              <IconButton name="x" title="关闭" onClick={() => setCommitOpen(false)} />
            </header>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">提交信息</span>
                <input
                  value={commitMessage}
                  onChange={(event) => setCommitMessage(event.target.value)}
                  placeholder="feat: update project archive"
                  className="focus-ring h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
                />
              </label>
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                {changedFiles.map((file) => (
                  <label
                    key={`commit-${file.path}`}
                    className="flex cursor-pointer items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.path)}
                      onChange={() => toggleCommitFile(file.path)}
                    />
                    <span className="mono h-5 min-w-8 rounded-md bg-[var(--surface-elevated)] px-2 text-center text-[11px] text-[var(--text-tertiary)]">
                      {file.status}
                    </span>
                    <span className="mono min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-secondary)]">
                      {file.path}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <Button variant="ghost" onClick={() => setCommitOpen(false)}>
                取消
              </Button>
              <Button variant="primary" disabled={working === "commit"} onClick={runCommit}>
                <AppIcon name="gitCommit" size={15} />
                {working === "commit" ? "提交中..." : "提交"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GitMeta({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div>
      <div className="mb-2 text-[11px] text-[var(--text-tertiary)]">{label}</div>
      <div className="mono flex items-center gap-2 text-[13px] font-semibold">
        <AppIcon name={icon} size={14} color="var(--text-secondary)" />
        {value}
      </div>
    </div>
  );
}

function mockChangedFiles(project: Project): GitChangedFile[] {
  if (project.git.state !== "dirty" || project.git.changes === 0) {
    return [];
  }

  return [
    { path: "src-tauri/src/git.rs", status: "M" },
    { path: "src/features/ProjectDetail.tsx", status: "M" },
  ].slice(0, Math.max(1, Math.min(project.git.changes, 2)));
}

function ArchiveTab({
  project,
  archive,
  onOpenAI,
  onSaveArchive,
}: {
  project: Project;
  archive: ArchiveState;
  onOpenAI: () => void;
  onSaveArchive: (key: ArchiveKey, text: string) => void;
}) {
  const keys = Object.keys(archive) as ArchiveKey[];
  const filled = archiveFilledCount(archive);

  if (filled === 0) {
    return (
      <div className="tab-content">
        <div className="panel pad overflow-hidden">
          <div className="rounded-[10px] border border-[var(--primary-ring)] bg-[var(--primary-soft)] p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] bg-[var(--primary)] text-white">
              <AppIcon name="sparkles" size={22} />
            </div>
            <h2 className="text-xl font-bold">给 {project.name} 留下一份项目档案</h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
              Memoir 会读取 README、关键配置和 Git 历史,生成一份几年后也能看懂的初稿。
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="primary" onClick={onOpenAI}>
                <AppIcon name="sparkles" size={15} />
                AI 生成初稿
              </Button>
              <Button variant="secondary" onClick={() => onSaveArchive("positioning", ARCHIVE_META.positioning.placeholder)}>
                手动填写
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {keys.map((key) => (
              <div key={key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                  <AppIcon name={ARCHIVE_META[key].icon} size={15} />
                  {ARCHIVE_META[key].title}
                </div>
                <div className="text-xs leading-relaxed text-[var(--text-tertiary)]">
                  {ARCHIVE_META[key].placeholder}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content space-y-4">
      <div className="panel-row">
        <div className="text-xs text-[var(--text-tertiary)]">项目档案 · 已填 {filled} / 4 分区</div>
        <Button variant="secondary" onClick={onOpenAI}>
          <AppIcon name="sparkles" size={15} />
          重新 AI 生成
        </Button>
      </div>
      {keys.map((key) => (
        <ArchiveCard key={key} keyName={key} archive={archive} onSave={onSaveArchive} />
      ))}
    </div>
  );
}

function ArchiveCard({
  keyName,
  archive,
  onSave,
}: {
  keyName: ArchiveKey;
  archive: ArchiveState;
  onSave: (key: ArchiveKey, text: string) => void;
}) {
  const section = archive[keyName];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.text);
  const meta = ARCHIVE_META[keyName];

  useEffect(() => {
    setDraft(section.text);
  }, [section.text]);

  return (
    <section className="archive-card">
      <header className="archive-head">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: section.filled ? "var(--success-soft)" : "var(--surface-elevated)",
              color: section.filled ? "var(--success)" : "var(--text-tertiary)",
            }}
          >
            <AppIcon name={meta.icon} size={16} />
          </span>
          <div>
            <div className="flex items-center gap-2 text-[15px] font-semibold">
              {meta.title}
              <span
                className="text-[11px] font-semibold"
                style={{ color: section.filled ? "var(--success)" : "var(--warning)" }}
              >
                {section.filled ? "已填" : "待填"}
              </span>
            </div>
          </div>
        </div>
        <IconButton name="edit" title="编辑" onClick={() => setEditing(true)} />
      </header>
      {editing ? (
        <div className="space-y-3 p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={meta.placeholder}
            className="focus-ring min-h-32 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(section.text);
                setEditing(false);
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onSave(keyName, draft);
                setEditing(false);
              }}
            >
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="archive-body">{section.filled ? section.text : meta.placeholder}</div>
      )}
    </section>
  );
}

function DocsTab({
  project,
  onToast,
}: {
  project: Project;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  const persisted = canUsePersistedProject(project);
  const [docs, setDocs] = useState<ProjectDocument[]>(project.docs);
  const [chatLinks, setChatLinks] = useState<ProjectChatLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [docType, setDocType] = useState<DocumentInput["type"]>("link");
  const [title, setTitle] = useState("");
  const [pathOrUrl, setPathOrUrl] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAdding, setChatAdding] = useState(false);
  const [chatMode, setChatMode] = useState<ChatLinkInput["kind"]>("link");
  const [chatSource, setChatSource] = useState<ChatLinkInput["source"]>("claude");
  const [chatTitle, setChatTitle] = useState("");
  const [chatTarget, setChatTarget] = useState("");
  const [chatSummary, setChatSummary] = useState("");
  const [importingChats, setImportingChats] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ChatImportCandidate[]>([]);
  const [selectedImportIndex, setSelectedImportIndex] = useState(0);
  const [chatDetailOpen, setChatDetailOpen] = useState(false);
  const [chatDetail, setChatDetail] = useState<ProjectChatDetail | null>(null);
  const [chatDetailSource, setChatDetailSource] = useState<ProjectChatLink | null>(null);
  const [loadingChatDetail, setLoadingChatDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDocs(project.docs);

    if (!persisted) return;
    setLoading(true);
    void listPersistedDocuments(project.id)
      .then((items) => {
        if (!cancelled && items) setDocs(items);
      })
      .catch((error) => {
        if (cancelled) return;
        console.log("[DEBUG][DocsTab.loadDocuments]", { error }, new Date().toISOString());
        onToast(error instanceof Error ? error.message : "资料读取失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, project.docs, persisted, onToast]);

  useEffect(() => {
    let cancelled = false;
    setChatLinks([]);

    if (!persisted) return;
    setLoadingChats(true);
    void listPersistedChatLinks(project.id)
      .then((items) => {
        if (!cancelled && items) setChatLinks(items);
      })
      .catch((error) => {
        if (cancelled) return;
        console.log("[DEBUG][DocsTab.loadChatLinks]", { error }, new Date().toISOString());
        onToast(error instanceof Error ? error.message : "聊天记录读取失败", "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingChats(false);
      });

    return () => {
      cancelled = true;
    };
  }, [project.id, persisted, onToast]);

  const resetForm = () => {
    setDocType("link");
    setTitle("");
    setPathOrUrl("");
  };

  const runAdd = async () => {
    const target = pathOrUrl.trim();
    if (!target) {
      onToast(docType === "link" ? "请输入外链" : `请选择或输入${docType === "local_dir" ? "本地文件夹" : "本地文件"}路径`, "warning");
      return;
    }

    const document: DocumentInput = {
      type: docType,
      title: title.trim() || undefined,
      pathOrUrl: target,
    };

    setAdding(true);
    try {
      const next = await addPersistedDocument(project.id, document);
      if (!next) {
        const mockDoc = mockDocument(document);
        setDocs((items) => [mockDoc, ...items]);
        onToast("浏览器预览模式: 已模拟添加资料", "success");
      } else {
        setDocs((items) => [next, ...items]);
        onToast(`已添加 ${next.name}`, "success");
      }
      resetForm();
      setAddOpen(false);
    } catch (error) {
      console.log("[DEBUG][DocsTab.runAdd]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "添加资料失败", "error");
    } finally {
      setAdding(false);
    }
  };

  const runPickDocumentPath = async () => {
    try {
      const selected =
        docType === "local_dir"
          ? await pickPersistedDirectory(pathOrUrl.trim() || project.path)
          : await pickPersistedFile(pathOrUrl.trim() || project.path);
      if (!selected) return;
      setPathOrUrl(selected);
      if (!title.trim()) {
        setTitle(pathBaseName(selected));
      }
    } catch (error) {
      console.log("[DEBUG][DocsTab.runPickDocumentPath]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "选择资料失败", "error");
    }
  };

  const runOpen = async (doc: ProjectDocument) => {
    try {
      if (!persisted || !doc.id) {
        onToast(`打开 ${doc.name}`, "success");
        return;
      }
      const message = await openPersistedDocument(project.id, doc.id);
      onToast(message ?? `已打开 ${doc.name}`, "success");
    } catch (error) {
      console.log("[DEBUG][DocsTab.runOpen]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "打开资料失败", "error");
    }
  };

  const runDelete = async (doc: ProjectDocument) => {
    try {
      if (persisted && doc.id) {
        await deletePersistedDocument(project.id, doc.id);
      }
      setDocs((items) => items.filter((item) => documentKey(item) !== documentKey(doc)));
      onToast("资料已删除", "success");
    } catch (error) {
      console.log("[DEBUG][DocsTab.runDelete]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "删除资料失败", "error");
    }
  };

  const resetChatForm = () => {
    setChatMode("link");
    setChatSource("claude");
    setChatTitle("");
    setChatTarget("");
    setChatSummary("");
    setImportCandidates([]);
    setSelectedImportIndex(0);
  };

  const runImportChatExport = async () => {
    const file = chatTarget.trim();
    if (!file) {
      onToast("请输入聊天导出文件路径", "warning");
      return;
    }

    setImportingChats(true);
    try {
      const candidates = await importPersistedChatExport(file);
      if (!candidates) {
        const mockCandidate = mockChatCandidate(file, chatSource);
        setImportCandidates([mockCandidate]);
        setSelectedImportIndex(0);
        onToast("浏览器预览模式: 已模拟解析聊天导出", "success");
        return;
      }
      setImportCandidates(candidates);
      setSelectedImportIndex(0);
      onToast(`解析到 ${candidates.length} 条对话`, "success");
    } catch (error) {
      console.log("[DEBUG][DocsTab.runImportChatExport]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "解析聊天导出失败", "error");
    } finally {
      setImportingChats(false);
    }
  };

  const runScanLocalChats = async (source: Extract<ChatLinkInput["source"], "codex" | "claude_code">) => {
    setChatMode("import");
    setChatSource(source);
    setImportingChats(true);
    try {
      const candidates = await scanPersistedLocalChatExports(source, 30);
      if (!candidates) {
        const mockCandidate = mockChatCandidate(
          source === "codex" ? "~/.codex/sessions" : "~/.claude/projects",
          source,
        );
        setImportCandidates([mockCandidate]);
        setSelectedImportIndex(0);
        onToast("浏览器预览模式: 已模拟扫描本地聊天记录", "success");
        return;
      }
      setImportCandidates(candidates);
      setSelectedImportIndex(0);
      onToast(
        candidates.length > 0
          ? `扫描到 ${candidates.length} 条${chatSourceLabel(source)}记录`
          : `没有扫描到${chatSourceLabel(source)}记录`,
        candidates.length > 0 ? "success" : "info",
      );
    } catch (error) {
      console.log("[DEBUG][DocsTab.runScanLocalChats]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "扫描本地聊天记录失败", "error");
    } finally {
      setImportingChats(false);
    }
  };

  const runAddChat = async () => {
    const target = chatTarget.trim();
    const candidate = chatMode === "import" ? importCandidates[selectedImportIndex] : null;

    if (chatMode === "link" && !target) {
      onToast("请输入聊天分享链接", "warning");
      return;
    }

    if (chatMode === "import" && !candidate) {
      onToast(
        target
          ? "请先点击「解析」并选择一条对话"
          : "请先填写聊天导出文件路径，或点击「扫描 Codex / 扫描 Claude Code」",
        "warning",
      );
      return;
    }

    const link: ChatLinkInput = candidate
      ? {
          source: candidate.source,
          kind: "import",
          urlOrFile: candidate.urlOrFile,
          title: candidate.title,
          summary: candidate.summary ?? undefined,
        }
      : {
          source: chatSource,
          kind: "link",
          urlOrFile: target,
          title: chatTitle.trim() || undefined,
          summary: chatSummary.trim() || undefined,
        };

    setChatAdding(true);
    try {
      const next = await addPersistedChatLink(project.id, link);
      if (!next) {
        const mockLink = mockChatLink(link);
        setChatLinks((items) => [mockLink, ...items]);
        onToast("浏览器预览模式: 已模拟关联聊天记录", "success");
      } else {
        setChatLinks((items) => [next, ...items]);
        onToast(`已关联 ${next.title}`, "success");
      }
      resetChatForm();
      setChatOpen(false);
    } catch (error) {
      console.log("[DEBUG][DocsTab.runAddChat]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "关联聊天记录失败", "error");
    } finally {
      setChatAdding(false);
    }
  };

  const closeChatDetail = () => {
    setChatDetailOpen(false);
    setChatDetail(null);
    setChatDetailSource(null);
    setLoadingChatDetail(false);
  };

  const runViewChat = async (chat: ProjectChatLink) => {
    if (chat.kind === "link") {
      await runOpenChat(chat);
      return;
    }

    setChatDetailOpen(true);
    setChatDetailSource(chat);
    setChatDetail(null);
    setLoadingChatDetail(true);
    try {
      if (!persisted || !chat.id) {
        setChatDetail(mockChatDetail(chat));
        return;
      }
      const detail = await readPersistedChatLinkDetail(project.id, chat.id);
      setChatDetail(detail ?? mockChatDetail(chat));
    } catch (error) {
      console.log("[DEBUG][DocsTab.runViewChat]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "读取聊天详情失败", "error");
      closeChatDetail();
    } finally {
      setLoadingChatDetail(false);
    }
  };

  const runOpenChat = async (chat: ProjectChatLink) => {
    try {
      if (!persisted || !chat.id) {
        onToast(`打开 ${chat.title}`, "success");
        return;
      }
      const message = await openPersistedChatLink(project.id, chat.id);
      onToast(message ?? `已打开 ${chat.title}`, "success");
    } catch (error) {
      console.log("[DEBUG][DocsTab.runOpenChat]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "打开聊天记录失败", "error");
    }
  };

  const runDeleteChat = async (chat: ProjectChatLink) => {
    try {
      if (persisted && chat.id) {
        await deletePersistedChatLink(project.id, chat.id);
      }
      setChatLinks((items) => items.filter((item) => chatLinkKey(item) !== chatLinkKey(chat)));
      onToast("聊天记录已删除", "success");
    } catch (error) {
      console.log("[DEBUG][DocsTab.runDeleteChat]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "删除聊天记录失败", "error");
    }
  };

  return (
    <div className="tab-content">
      <div className="mb-3 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setChatOpen(true)}>
          <AppIcon name="link" size={15} />
          关联聊天
        </Button>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <AppIcon name="plus" size={15} />
          添加资料
        </Button>
      </div>
      {loading ? (
        <div className="code-placeholder panel">
          <AppIcon name="clock" size={18} />
          <span>正在读取资料...</span>
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon="link"
          title="还没有关联资料"
          body="可以关联本地文档、设计稿、部署控制台或历史对话。"
        />
      ) : (
        <div className="panel overflow-hidden">
          {docs.map((doc) => (
            <div
              key={documentKey(doc)}
              role="button"
              tabIndex={0}
              className="doc-row flex w-full cursor-pointer items-center gap-3 border-0 border-b border-[var(--border)] bg-transparent px-4 py-3 text-left last:border-b-0"
              onClick={() => void runOpen(doc)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                void runOpen(doc);
              }}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--accent)]">
                <AppIcon name={documentIcon(doc)} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{doc.name}</span>
                <span className="mono block truncate text-xs text-[var(--text-tertiary)]">{doc.meta}</span>
              </span>
              <AppIcon name={doc.type === "link" ? "external" : "folderOpen"} size={16} />
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  void runDelete(doc);
                }}
              >
                <IconButton name="x" title="删除资料" danger />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="section-label">聊天记录 · {chatLinks.length}</div>
          <Button variant="ghost" onClick={() => setChatOpen(true)}>
            <AppIcon name="plus" size={14} />
            关联
          </Button>
        </div>
        {loadingChats ? (
          <div className="code-placeholder panel">
            <AppIcon name="clock" size={18} />
            <span>正在读取聊天记录...</span>
          </div>
        ) : chatLinks.length === 0 ? (
          <div className="panel pad text-[13px] text-[var(--text-tertiary)]">
            还没有关联 Claude、ChatGPT、Claude Code 或 Codex 对话。
          </div>
        ) : (
          <div className="panel overflow-hidden">
            {chatLinks.map((chat) => (
              <div
                key={chatLinkKey(chat)}
                role="button"
                tabIndex={0}
                className="doc-row flex w-full cursor-pointer items-start gap-3 border-0 border-b border-[var(--border)] bg-transparent px-4 py-3 text-left last:border-b-0"
                onClick={() => void runViewChat(chat)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  void runViewChat(chat);
                }}
              >
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--accent)]">
                  <AppIcon name={chat.kind === "link" ? "external" : "file"} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="block truncate text-[13.5px] font-semibold">{chat.title}</span>
                    <TagChip>{chatSourceLabel(chat.source)}</TagChip>
                    <TagChip>{chat.kind === "link" ? "分享链接" : "导出文件"}</TagChip>
                  </span>
                  {chat.summary ? (
                    <span className="mt-1 block line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                      {chat.summary}
                    </span>
                  ) : null}
                  <span className="mono mt-1 block truncate text-xs text-[var(--text-tertiary)]">
                    {chat.urlOrFile}
                  </span>
                </span>
                <AppIcon name={chat.kind === "link" ? "external" : "folderOpen"} size={16} />
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    void runDeleteChat(chat);
                  }}
                >
                  <IconButton name="x" title="删除聊天记录" danger />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen ? (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="panel-row border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold">添加资料</h2>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  关联到 {project.name}
                </div>
              </div>
              <IconButton name="x" title="关闭" onClick={() => setAddOpen(false)} />
            </header>
            <div className="space-y-4 p-5">
              <div className="flex gap-2">
                {[
                  { id: "link", label: "外链", icon: "external" as IconName },
                  { id: "local_file", label: "本地文件", icon: "file" as IconName },
                  { id: "local_dir", label: "本地文件夹", icon: "folder" as IconName },
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={docType === item.id ? "primary" : "secondary"}
                    onClick={() => {
                      setDocType(item.id as DocumentInput["type"]);
                      setPathOrUrl("");
                    }}
                  >
                    <AppIcon name={item.icon} size={15} />
                    {item.label}
                  </Button>
                ))}
              </div>
              <label className="block">
                <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">标题</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="留空则自动生成"
                  className="focus-ring h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">
                  {docType === "link" ? "链接" : docType === "local_dir" ? "本地文件夹路径" : "本地文件路径"}
                </span>
                <div className="flex gap-2">
                  <input
                    value={pathOrUrl}
                    onChange={(event) => setPathOrUrl(event.target.value)}
                    placeholder={
                      docType === "link"
                        ? "https://example.com"
                        : docType === "local_dir"
                          ? "/Users/me/project/docs"
                          : "/Users/me/project/README.md"
                    }
                    className="focus-ring mono h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
                  />
                  {docType !== "link" ? (
                    <Button variant="secondary" onClick={() => void runPickDocumentPath()}>
                      {docType === "local_dir" ? "选择文件夹" : "选择文件"}
                    </Button>
                  ) : null}
                </div>
              </label>
            </div>
            <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                取消
              </Button>
              <Button variant="primary" disabled={adding} onClick={runAdd}>
                <AppIcon name="plus" size={15} />
                {adding ? "添加中..." : "添加"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {chatOpen ? (
        <div className="modal-backdrop" onClick={() => setChatOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <header className="panel-row border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold">关联聊天记录</h2>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Claude / ChatGPT / Claude Code / Codex 对话会保存到 {project.name}
                </div>
              </div>
              <IconButton name="x" title="关闭" onClick={() => setChatOpen(false)} />
            </header>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "link", label: "分享链接", icon: "external" as IconName },
                  { id: "import", label: "导出文件", icon: "file" as IconName },
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={chatMode === item.id ? "primary" : "secondary"}
                    onClick={() => {
                      setChatMode(item.id as ChatLinkInput["kind"]);
                      setImportCandidates([]);
                      setSelectedImportIndex(0);
                    }}
                  >
                    <AppIcon name={item.icon} size={15} />
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "claude", label: "Claude" },
                  { id: "chatgpt", label: "ChatGPT" },
                  { id: "claude_code", label: "Claude Code" },
                  { id: "codex", label: "Codex" },
                ].map((item) => (
                  <Button
                    key={item.id}
                    variant={chatSource === item.id ? "primary" : "secondary"}
                    onClick={() => setChatSource(item.id as ChatLinkInput["source"])}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              {chatMode === "link" ? (
                <label className="block">
                  <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">标题</span>
                  <input
                    value={chatTitle}
                    onChange={(event) => setChatTitle(event.target.value)}
                    placeholder="留空则自动生成"
                    className="focus-ring h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">
                  {chatMode === "link" ? "分享链接" : "导出文件路径"}
                </span>
                <div className="flex gap-2">
                  <input
                    value={chatTarget}
                    onChange={(event) => setChatTarget(event.target.value)}
                    placeholder={
                      chatMode === "link"
                        ? "https://claude.ai/share/... 或 https://chatgpt.com/share/..."
                        : "/Users/me/.codex/sessions/.../rollout-xxx.jsonl"
                    }
                    className="focus-ring mono h-10 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text-primary)] outline-none"
                  />
                  {chatMode === "import" ? (
                    <Button variant="secondary" disabled={importingChats} onClick={() => void runImportChatExport()}>
                      {importingChats ? "解析中..." : "解析"}
                    </Button>
                  ) : null}
                </div>
              </label>
              {chatMode === "import" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={importingChats}
                    onClick={() => void runScanLocalChats("codex")}
                  >
                    扫描 Codex
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={importingChats}
                    onClick={() => void runScanLocalChats("claude_code")}
                  >
                    扫描 Claude Code
                  </Button>
                </div>
              ) : null}
              {chatMode === "link" ? (
                <label className="block">
                  <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">摘要</span>
                  <textarea
                    value={chatSummary}
                    onChange={(event) => setChatSummary(event.target.value)}
                    placeholder="可选: 一句话说明这段对话解决了什么"
                    className="focus-ring min-h-20 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-[13px] text-[var(--text-primary)] outline-none"
                  />
                </label>
              ) : null}
              {chatMode === "import" && importCandidates.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[12px] text-[var(--text-tertiary)]">
                    选择要关联的对话 · {importCandidates.length}
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {importCandidates.map((candidate, index) => (
                      <button
                        key={`${candidate.title}-${index}`}
                        className={`focus-ring w-full rounded-lg border px-3 py-2 text-left transition ${
                          selectedImportIndex === index
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)]"
                        }`}
                        onClick={() => setSelectedImportIndex(index)}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[13px] font-semibold">{candidate.title}</span>
                          <TagChip>{chatSourceLabel(candidate.source)}</TagChip>
                        </span>
                        {candidate.summary ? (
                          <span className="mt-1 block line-clamp-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                            {candidate.summary}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <Button variant="ghost" onClick={() => setChatOpen(false)}>
                取消
              </Button>
              <Button variant="primary" disabled={chatAdding} onClick={() => void runAddChat()}>
                <AppIcon name="plus" size={15} />
                {chatAdding ? "关联中..." : "关联"}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}

      {chatDetailOpen ? (
        <div className="modal-backdrop" onClick={closeChatDetail}>
          <div className="modal chat-detail-modal" onClick={(event) => event.stopPropagation()}>
            <header className="panel-row border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-bold">
                  {chatDetail?.title ?? chatDetailSource?.title ?? "聊天详情"}
                </h2>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                  {chatDetailSource ? <TagChip>{chatSourceLabel(chatDetailSource.source)}</TagChip> : null}
                  {chatDetailSource ? <TagChip>{chatDetailSource.kind === "link" ? "分享链接" : "导出文件"}</TagChip> : null}
                  {chatDetail?.truncated ? <TagChip>已截断</TagChip> : null}
                </div>
              </div>
              <IconButton name="x" title="关闭" onClick={closeChatDetail} />
            </header>
            <div className="chat-detail-body">
              {loadingChatDetail ? (
                <div className="code-placeholder">
                  <AppIcon name="clock" size={18} />
                  <span>正在读取聊天详情...</span>
                </div>
              ) : chatDetail ? (
                <pre className="chat-detail-pre">{chatDetail.content}</pre>
              ) : (
                <div className="code-placeholder">
                  <AppIcon name="file" size={18} />
                  <span>没有读取到可展示的正文</span>
                </div>
              )}
            </div>
            <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
              <div className="mono min-w-0 truncate text-[12px] text-[var(--text-tertiary)]">
                {chatDetail?.urlOrFile ?? chatDetailSource?.urlOrFile}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {chatDetailSource ? (
                  <Button variant="secondary" onClick={() => void runOpenChat(chatDetailSource)}>
                    <AppIcon name={chatDetailSource.kind === "link" ? "external" : "folderOpen"} size={15} />
                    {chatDetailSource.kind === "link" ? "打开链接" : "在 Finder 中显示"}
                  </Button>
                ) : null}
                <Button variant="primary" onClick={closeChatDetail}>
                  关闭
                </Button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function documentKey(doc: ProjectDocument): string {
  return doc.id ?? `${doc.type}-${doc.name}-${doc.pathOrUrl ?? doc.meta}`;
}

function documentIcon(doc: ProjectDocument): IconName {
  if (doc.type === "file") return "file";
  if (doc.type === "folder") return "folder";
  return "external";
}

function pathBaseName(path: string): string {
  return path.split("/").filter(Boolean).pop() || path;
}

function chatLinkKey(chat: ProjectChatLink): string {
  return chat.id ?? `${chat.source}-${chat.kind}-${chat.title}-${chat.urlOrFile}`;
}

function chatSourceLabel(source: ProjectChatLink["source"]): string {
  if (source === "chatgpt") return "ChatGPT";
  if (source === "claude_code") return "Claude Code";
  if (source === "codex") return "Codex";
  return "Claude";
}

function mockDocument(input: DocumentInput): ProjectDocument {
  const type = input.type === "local_file" ? "file" : input.type === "local_dir" ? "folder" : "link";
  const pathParts = input.pathOrUrl.split("/").filter(Boolean);
  const name =
    input.title?.trim() ||
    (type === "link"
      ? input.pathOrUrl.replace(/^https?:\/\//i, "").split("/")[0]
      : pathParts[pathParts.length - 1]) ||
    input.pathOrUrl;
  return {
    id: `mock-${Date.now()}`,
    type,
    name,
    meta: type === "link" ? input.pathOrUrl.replace(/^https?:\/\//i, "").split("/")[0] : input.pathOrUrl,
    pathOrUrl: input.pathOrUrl,
    createdAt: new Date().toISOString(),
  };
}

function mockChatCandidate(file: string, source: ChatLinkInput["source"]): ChatImportCandidate {
  const parts = file.split("/").filter(Boolean);
  return {
    source,
    kind: "import",
    urlOrFile: file,
    title: parts[parts.length - 1] || "聊天导出",
    summary: "浏览器预览模式下模拟解析的聊天导出。",
    capturedAt: new Date().toISOString(),
  };
}

function mockChatLink(input: ChatLinkInput): ProjectChatLink {
  return {
    id: `mock-chat-${Date.now()}`,
    source: input.source,
    kind: input.kind,
    title: input.title?.trim() || (input.kind === "link" ? input.urlOrFile.replace(/^https?:\/\//i, "").split("/")[0] : "聊天导出"),
    summary: input.summary?.trim() || null,
    urlOrFile: input.urlOrFile,
    capturedAt: new Date().toISOString(),
  };
}

function mockChatDetail(chat: ProjectChatLink): ProjectChatDetail {
  return {
    ...chat,
    content: chat.summary || "浏览器预览模式下模拟展示的聊天详情。",
    truncated: false,
  };
}

function findFirstFile(node: FileNode): string | null {
  if (node.type === "file") return node.name;
  for (const child of node.children ?? []) {
    const found = findFirstFile(child);
    if (found) return found;
  }
  return null;
}

function previewCode(fileName: string, project: Project): string[] {
  if (fileName.endsWith(".json")) {
    return [
      "{",
      `  "name": "${project.name}",`,
      '  "private": true,',
      '  "scripts": {',
      '    "dev": "vite",',
      '    "tauri": "tauri"',
      "  }",
      "}",
    ];
  }
  if (fileName.endsWith(".rs")) {
    return [
      "use tauri::command;",
      "",
      "#[command]",
      "fn git_status(project_id: i64) -> Result<String, String> {",
      "    // Rust 侧执行系统 git 命令,前端只拿结果。",
      "    Ok(format!(\"status for {}\", project_id))",
      "}",
    ];
  }
  if (fileName.endsWith(".py")) {
    return [
      "from pathlib import Path",
      "",
      "def main() -> None:",
      "    root = Path.cwd()",
      "    print(f'scanning {root}')",
      "",
      "if __name__ == '__main__':",
      "    main()",
    ];
  }
  return [
    "import { invoke } from '@tauri-apps/api/core';",
    "",
    "export async function loadProject(id: string) {",
    "  const project = await invoke('get_project', { id });",
    "  return project;",
    "}",
    "",
    `// ${project.name}: ${project.description || "待补档案"}`,
  ];
}
