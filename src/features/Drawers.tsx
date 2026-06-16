import { useEffect, useState } from "react";
import { AppIcon } from "../components/AppIcon";
import { Button, IconButton } from "../components/Primitives";
import { archiveFilledCount } from "../lib/completeness";
import {
  addPersistedProject,
  canUsePersistedProject,
  generateArchiveAi,
  getPersistedGitDiff,
  isTauriRuntime,
  listPersistedProjects,
  pickPersistedDirectory,
  scanPersistedProjects,
} from "../lib/projects-api";
import type { GitDiff, GitDiffFile } from "../lib/projects-api";
import type { ArchiveKey, ArchiveState, CommitInfo, Project } from "../lib/types";

const AI_DRAFTS: Record<ArchiveKey, string> = {
  positioning:
    "这是一个本地优先的开发者项目记忆库,用于扫描并管理本机代码仓库。核心目标是在几个月或几年后重新打开项目时,仍能快速理解它的定位、结构、运行方式和历史上下文。",
  tech:
    "前端使用 React + TypeScript + Vite,桌面壳为 Tauri 2。数据存储在本地 SQLite,Git 信息由 Rust 命令调用系统 git 获取,DeepSeek 请求由 Rust 侧转发以避免前端持有 API Key。",
  deploy:
    "开发阶段使用 pnpm tauri dev。生产阶段通过 Tauri bundler 输出 dmg / msi / AppImage。所有数据默认保存在本机应用目录,项目档案写入各项目 .memoir/archive.md。",
  todos:
    "- [ ] 补齐 SQLite 迁移与首次启动建库\n- [ ] 接入真实项目扫描与 Git 读取命令\n- [ ] 增加 DeepSeek API Key 验证和 AI 生成错误态\n- [ ] 完成资料关联的本地文件打开与外链打开",
};

const AI_KEYS: ArchiveKey[] = ["positioning", "tech", "deploy", "todos"];

interface DiffDrawerProps {
  open: boolean;
  commit: CommitInfo | null;
  mode: "commit" | "working";
  file?: string | null;
  project: Project | null;
  onClose: () => void;
}

const MOCK_DIFF_FILES: GitDiffFile[] = [
  {
    path: "src/commands/git.rs",
    additions: 42,
    deletions: 6,
    lines: [
      { kind: "meta", content: "@@ -18,7 +18,9 @@" },
      { kind: "ctx", content: " const messages = buildPrompt(repo);" },
      { kind: "del", content: "- const res = await client.chat(messages);" },
      { kind: "add", content: "+ const stream = await client.chatStream(messages);" },
      { kind: "add", content: "+ for await (const chunk of stream) {" },
      { kind: "add", content: "+   onToken(chunk.delta);" },
      { kind: "add", content: "+ }" },
      { kind: "ctx", content: " return assemble();" },
    ],
  },
  {
    path: "src/features/archive/ArchiveDrawer.tsx",
    additions: 96,
    deletions: 8,
    lines: [
      { kind: "meta", content: "@@ -1,4 +1,6 @@" },
      { kind: "add", content: "+ import { useStream } from '../../hooks/useStream';" },
      { kind: "ctx", content: "" },
      { kind: "del", content: "- const [text, setText] = useState('');" },
      { kind: "add", content: "+ const { sections, adopt } = useStream(project);" },
    ],
  },
];

export function DiffDrawer({ open, commit, mode, file, project, onClose }: DiffDrawerProps) {
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persisted = project ? canUsePersistedProject(project) : false;

  useEffect(() => {
    if (!open || !project || !persisted) {
      setDiff(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void getPersistedGitDiff({
      id: project.id,
      file,
      commit: mode === "commit" ? commit?.hash : null,
    })
      .then((nextDiff) => {
        if (cancelled) return;
        setDiff(nextDiff);
      })
      .catch((nextError) => {
        if (cancelled) return;
        console.log("[DEBUG][DiffDrawer.loadDiff]", { error: nextError }, new Date().toISOString());
        setError(nextError instanceof Error ? nextError.message : "Diff 读取失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, project, persisted, mode, commit?.hash, file]);

  if (!open) return null;
  const title = file ?? (mode === "working" ? "工作区改动" : commit?.msg ?? "Commit Diff");
  const files = diff?.files ?? MOCK_DIFF_FILES;
  const additions = diff?.additions ?? files.reduce((sum, item) => sum + item.additions, 0);
  const deletions = diff?.deletions ?? files.reduce((sum, item) => sum + item.deletions, 0);
  const total = additions + deletions;
  const addRatio = total > 0 ? Math.round((additions / total) * 100) : 0;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header className="panel-row border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
              <AppIcon name="gitCommit" size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-bold">{title}</h2>
              <div className="mono mt-1 text-xs text-[var(--text-tertiary)]">
                {commit?.hash ?? "working"} · {project?.name ?? "project"}
              </div>
            </div>
          </div>
          <IconButton name="x" title="关闭" onClick={onClose} />
        </header>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center justify-between text-[12.5px] text-[var(--text-secondary)]">
            <span>{loading ? "正在读取 Diff..." : `${files.length} 个文件改动`}</span>
            <span className="mono">
              <span className="text-[var(--diff-add-text)]">+{additions}</span>
              <span className="mx-2 text-[var(--text-tertiary)]">·</span>
              <span className="text-[var(--diff-del-text)]">-{deletions}</span>
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
            <div className="h-full rounded-l-full bg-[var(--success)]" style={{ width: `${addRatio}%` }} />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {error ? (
            <div className="rounded-lg border border-[var(--error-soft)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--error)]">
              {error}
            </div>
          ) : null}
          {!error && files.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-8 text-center text-sm text-[var(--text-tertiary)]">
              没有可展示的 Diff
            </div>
          ) : null}
          {!error ? files.map((diffFile) => <DiffFile key={diffFile.path} file={diffFile} />) : null}
        </div>
      </aside>
    </div>
  );
}

function DiffFile({ file }: { file: GitDiffFile }) {
  return (
    <div className="mb-4 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="panel-row border-b border-[var(--border)] px-3 py-2">
        <div className="mono flex items-center gap-2 text-[12.5px]">
          <AppIcon name="fileCode" size={14} />
          {file.path}
        </div>
        <div className="mono text-xs">
          <span className="text-[var(--diff-add-text)]">+{file.additions}</span>
          <span className="mx-2 text-[var(--text-tertiary)]"> </span>
          <span className="text-[var(--diff-del-text)]">-{file.deletions}</span>
        </div>
      </div>
      <div className="mono overflow-x-auto text-[12.5px]">
        {file.lines.map((line, index) => (
          <div
            key={`${file.path}-${index}`}
            className="min-w-[560px] px-3 py-1"
            style={{
              background: line.kind === "add" ? "var(--diff-add)" : line.kind === "del" ? "var(--diff-del)" : "transparent",
              color:
                line.kind === "add"
                  ? "var(--diff-add-text)"
                  : line.kind === "del"
                    ? "var(--diff-del-text)"
                    : line.kind === "meta"
                      ? "var(--accent)"
                    : "var(--text-secondary)",
            }}
          >
            {line.content || " "}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AIDrawerProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onAdopt: (key: ArchiveKey, text: string) => void;
  onAdoptAll: (archive: ArchiveState) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}

export function AIDrawer({ open, project, onClose, onAdopt, onAdoptAll, onToast }: AIDrawerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [texts, setTexts] = useState<Record<ArchiveKey, string>>({
    positioning: "",
    tech: "",
    deploy: "",
    todos: "",
  });
  const [done, setDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceFiles, setSourceFiles] = useState<string[]>([]);
  const persisted = project ? canUsePersistedProject(project) : false;

  useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;
    const projectId = project.id;

    setCurrentIndex(0);
    setTexts({ positioning: "", tech: "", deploy: "", todos: "" });
    setDone(false);
    setGenerating(persisted);
    setError(null);
    setSourceFiles([]);

    if (!persisted) {
      return () => {
        cancelled = true;
      };
    }

    async function generateDraft() {
      try {
        const draft = await generateArchiveAi(projectId);
        if (!draft || cancelled) return;
        setTexts(archiveToTexts(draft.archive));
        setSourceFiles(draft.sourceFiles);
        setDone(true);
        onToast("DeepSeek 初稿已生成", "success");
      } catch (nextError) {
        console.log("[DEBUG][AIDrawer.generateDraft]", { error: nextError }, new Date().toISOString());
        if (cancelled) return;
        setError(nextError instanceof Error ? nextError.message : "AI 生成失败");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }

    void generateDraft();
    return () => {
      cancelled = true;
    };
  }, [open, project?.id, persisted, onToast]);

  useEffect(() => {
    if (!open || persisted || done || generating || error) return;
    const key = AI_KEYS[currentIndex];
    if (!key) {
      setDone(true);
      return;
    }

    const timer = window.setInterval(() => {
      setTexts((state) => {
        const full = AI_DRAFTS[key];
        if (state[key].length >= full.length) return state;
        const next = full.slice(0, state[key].length + 2);
        return { ...state, [key]: next };
      });
    }, 16);

    return () => window.clearInterval(timer);
  }, [open, currentIndex, done, persisted, generating, error]);

  useEffect(() => {
    if (!open || persisted || done || generating || error) return;
    const key = AI_KEYS[currentIndex];
    if (key && texts[key].length >= AI_DRAFTS[key].length) {
      const t = window.setTimeout(() => setCurrentIndex((index) => index + 1), 220);
      return () => window.clearTimeout(t);
    }
    if (!key) setDone(true);
  }, [texts, currentIndex, open, done, persisted, generating, error]);

  if (!open || !project) return null;
  const savingArchive = textsToArchive(texts);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <header className="panel-row border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <AppIcon name="sparkles" size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-bold">AI 生成项目档案</h2>
              <div className="mono mt-1 text-xs text-[var(--text-tertiary)]">
                读取 {project.name} 的文件树与关键文件
              </div>
            </div>
          </div>
          <IconButton name="x" title="关闭" onClick={onClose} />
        </header>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {error ? (
            <div className="rounded-[10px] border border-[var(--error-soft)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--error)]">
              {error}
            </div>
          ) : null}
          {sourceFiles.length > 0 ? (
            <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-xs text-[var(--text-tertiary)]">
              参考文件: {sourceFiles.join(" · ")}
            </div>
          ) : null}
          {AI_KEYS.map((key, index) => {
            const active = !persisted && index === currentIndex && !done;
            const complete = done && texts[key].trim().length > 0;
            const pending = generating || (!persisted && index > currentIndex);
            return (
              <section
                key={key}
                className="rounded-[10px] border p-4"
                style={{
                  borderColor: active ? "var(--primary-ring)" : "var(--border)",
                  background: active ? "var(--surface-elevated)" : "var(--surface)",
                  opacity: pending ? 0.58 : 1,
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                    <AppIcon name="tag" size={14} />
                    {archiveTitle(key)}
                    {active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--primary)]" /> : null}
                  </div>
                  {complete ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onAdopt(key, texts[key]);
                        onToast(`已采纳「${archiveTitle(key)}」`, "success");
                      }}
                    >
                      保存此段
                    </Button>
                  ) : null}
                </div>
                {done ? (
                  <textarea
                    value={texts[key]}
                    onChange={(event) =>
                      setTexts((state) => ({ ...state, [key]: event.target.value }))
                    }
                    className="focus-ring min-h-32 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-[13.5px] leading-relaxed text-[var(--text-primary)] outline-none"
                    placeholder={`校对「${archiveTitle(key)}」`}
                  />
                ) : (
                  <p className="min-h-10 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                    {generating && !texts[key] ? "等待 DeepSeek 返回..." : texts[key]}
                    {active ? <span className="ml-0.5 inline-block h-4 w-1 animate-[caretBlink_1s_infinite] bg-[var(--primary)] align-[-2px]" /> : null}
                  </p>
                )}
              </section>
            );
          })}
        </div>

        <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-3">
          <div className="text-xs text-[var(--text-tertiary)]">
            {error ? "生成失败" : done ? "可校对后保存" : "正在生成..."}
          </div>
          <Button
            variant="primary"
            disabled={!done || archiveFilledCount(savingArchive) === 0}
            onClick={() => {
              onAdoptAll(savingArchive);
              onClose();
            }}
          >
            <AppIcon name="check" size={15} />
            保存全部
          </Button>
        </footer>
      </aside>
    </div>
  );
}

interface AddProjectModalProps {
  open: boolean;
  onClose: () => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onProjectsChange: (projects: Project[]) => void;
}

export function AddProjectModal({ open, onClose, onToast, onProjectsChange }: AddProjectModalProps) {
  const [scanning, setScanning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState("~/dev");
  const [count, setCount] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [scanSummary, setScanSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setAdding(false);
      setCount(0);
      setScanDone(false);
      setScanSummary(null);
    }
  }, [open]);

  if (!open) return null;

  const runScan = async () => {
    const trimmed = path.trim();
    if (!trimmed) {
      onToast("请输入扫描目录", "warning");
      return;
    }
    setScanning(true);
    setScanDone(false);
    setScanSummary(null);
    setCount(0);

    try {
      const result = await scanPersistedProjects(trimmed);
      if (!result) {
        window.setTimeout(() => {
          setCount(7);
          setScanDone(true);
          setScanSummary("浏览器预览模式: 模拟发现 7 个项目");
          setScanning(false);
        }, 780);
        return;
      }

      setCount(result.discovered);
      setScanDone(true);
      setScanSummary(`发现 ${result.discovered} 个项目 · 新增 ${result.inserted} · 跳过 ${result.skipped}`);
      onProjectsChange(result.projects);
      onToast(`扫描完成,新增 ${result.inserted} 个项目`, result.inserted > 0 ? "success" : "info");
    } catch (error) {
      console.log("[DEBUG][runScan]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "扫描失败", "error");
    } finally {
      setScanning(false);
    }
  };

  const runAddProject = async () => {
    const trimmed = path.trim();
    if (!trimmed) {
      onToast("请输入项目目录", "warning");
      return;
    }
    setAdding(true);
    try {
      const project = await addPersistedProject(trimmed);
      if (!project) {
        onToast("浏览器预览模式暂不写入项目", "info");
        return;
      }
      onProjectsChange((await listPersistedProjects()) ?? [project]);
      onToast(`已添加 ${project.name}`, "success");
      onClose();
    } catch (error) {
      console.log("[DEBUG][runAddProject]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "添加项目失败", "error");
    } finally {
      setAdding(false);
    }
  };

  const browseDirectory = async () => {
    if (!isTauriRuntime()) {
      onToast("浏览器预览模式暂不支持系统目录选择", "info");
      return;
    }

    try {
      const selected = await pickPersistedDirectory(path);
      if (!selected) return;
      setPath(selected);
    } catch (error) {
      console.log("[DEBUG][AddProjectModal.browseDirectory]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "选择目录失败", "error");
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="panel-row border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--primary-soft)] text-[var(--primary)]">
              <AppIcon name="folderOpen" size={18} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold">添加扫描目录</h2>
              <div className="text-xs text-[var(--text-tertiary)]">Memoir 会递归发现目录下的所有代码仓库</div>
            </div>
          </div>
          <IconButton name="x" title="关闭" onClick={onClose} />
        </header>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-2 block text-[12px] text-[var(--text-tertiary)]">根目录路径</span>
            <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3">
              <AppIcon name="folder" size={15} color="var(--text-tertiary)" />
              <input
                className="mono min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
              <Button size="sm" variant="secondary" onClick={() => void browseDirectory()}>
                浏览
              </Button>
            </div>
          </label>

          <div className="flex min-h-[96px] items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg)] text-center">
            {scanning ? (
              <div>
                <AppIcon
                  name="sparkles"
                  size={24}
                  className="mx-auto animate-[spin_1s_linear_infinite] text-[var(--primary)]"
                />
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  正在扫描项目...
                </div>
              </div>
            ) : scanDone ? (
              <div>
                <div className="mono text-[24px] font-bold text-[var(--text-primary)]">{count}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">{scanSummary ?? "扫描完成"}</div>
              </div>
            ) : (
              <div className="text-[13px] text-[var(--text-tertiary)]">
                点击「扫描」导入 Git 仓库,或直接添加该目录为普通项目
              </div>
            )}
          </div>
        </div>

        <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <Button
            variant="ghost"
            onClick={runScan}
            disabled={scanning || adding}
          >
            <AppIcon
              name="sparkles"
              size={15}
              className={scanning ? "animate-[spin_1s_linear_infinite]" : ""}
            />
            扫描
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              variant={scanDone ? "primary" : "secondary"}
              disabled={scanning || adding}
              onClick={scanDone ? onClose : runAddProject}
            >
              <AppIcon name={scanDone ? "check" : "plus"} size={15} />
              {scanDone ? `完成` : adding ? "添加中..." : "添加为普通项目"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function archiveTitle(key: ArchiveKey) {
  const titles: Record<ArchiveKey, string> = {
    positioning: "项目定位",
    tech: "技术栈与设计",
    deploy: "运行部署运维",
    todos: "待办与已知问题",
  };
  return titles[key];
}

function archiveToTexts(archive: ArchiveState): Record<ArchiveKey, string> {
  return AI_KEYS.reduce<Record<ArchiveKey, string>>(
    (acc, key) => {
      acc[key] = archive[key]?.text ?? "";
      return acc;
    },
    { positioning: "", tech: "", deploy: "", todos: "" },
  );
}

function textsToArchive(texts: Record<ArchiveKey, string>): ArchiveState {
  return AI_KEYS.reduce<ArchiveState>((acc, key) => {
    const text = texts[key] ?? "";
    acc[key] = { filled: text.trim().length > 0, text };
    return acc;
  }, {} as ArchiveState);
}
