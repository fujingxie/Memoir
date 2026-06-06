import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "../components/AppIcon";
import { Button, IconButton } from "../components/Primitives";
import type { ArchiveKey, CommitInfo, Project } from "../lib/types";

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
  project: Project | null;
  onClose: () => void;
}

export function DiffDrawer({ open, commit, mode, project, onClose }: DiffDrawerProps) {
  if (!open) return null;
  const title = mode === "working" ? "工作区改动" : commit?.msg ?? "Commit Diff";

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
            <span>2 个文件改动</span>
            <span className="mono">
              <span className="text-[var(--diff-add-text)]">+138</span>
              <span className="mx-2 text-[var(--text-tertiary)]">·</span>
              <span className="text-[var(--diff-del-text)]">-14</span>
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
            <div className="h-full w-[86%] rounded-l-full bg-[var(--success)]" />
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <DiffFile name="src/commands/git.rs" add={42} del={6} />
          <DiffFile name="src/features/archive/ArchiveDrawer.tsx" add={96} del={8} second />
        </div>
      </aside>
    </div>
  );
}

function DiffFile({ name, add, del, second = false }: { name: string; add: number; del: number; second?: boolean }) {
  const lines = second
    ? [
        ["ctx", "@@ -1,4 +1,6 @@"],
        ["add", "+ import { useStream } from '../../hooks/useStream';"],
        ["ctx", ""],
        ["del", "- const [text, setText] = useState('');"],
        ["add", "+ const { sections, adopt } = useStream(project);"],
      ]
    : [
        ["ctx", "@@ -18,7 +18,9 @@"],
        ["ctx", " const messages = buildPrompt(repo);"],
        ["del", "- const res = await client.chat(messages);"],
        ["add", "+ const stream = await client.chatStream(messages);"],
        ["add", "+ for await (const chunk of stream) {"],
        ["add", "+   onToken(chunk.delta);"],
        ["add", "+ }"],
        ["ctx", " return assemble();"],
      ];

  return (
    <div className="mb-4 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="panel-row border-b border-[var(--border)] px-3 py-2">
        <div className="mono flex items-center gap-2 text-[12.5px]">
          <AppIcon name="fileCode" size={14} />
          {name}
        </div>
        <div className="mono text-xs">
          <span className="text-[var(--diff-add-text)]">+{add}</span>
          <span className="mx-2 text-[var(--text-tertiary)]"> </span>
          <span className="text-[var(--diff-del-text)]">-{del}</span>
        </div>
      </div>
      <div className="mono overflow-x-auto text-[12.5px]">
        {lines.map(([kind, line], index) => (
          <div
            key={`${name}-${index}`}
            className="min-w-[560px] px-3 py-1"
            style={{
              background:
                kind === "add" ? "var(--diff-add)" : kind === "del" ? "var(--diff-del)" : "transparent",
              color:
                kind === "add"
                  ? "var(--diff-add-text)"
                  : kind === "del"
                    ? "var(--diff-del-text)"
                    : "var(--text-secondary)",
            }}
          >
            {line || " "}
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
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}

export function AIDrawer({ open, project, onClose, onAdopt, onToast }: AIDrawerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [texts, setTexts] = useState<Record<ArchiveKey, string>>({
    positioning: "",
    tech: "",
    deploy: "",
    todos: "",
  });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);
    setTexts({ positioning: "", tech: "", deploy: "", todos: "" });
    setDone(false);
  }, [open, project?.id]);

  useEffect(() => {
    if (!open || done) return;
    const key = AI_KEYS[currentIndex];
    if (!key) {
      setDone(true);
      return;
    }

    const timer = window.setInterval(() => {
      setTexts((state) => {
        const full = AI_DRAFTS[key];
        const next = full.slice(0, state[key].length + 2);
        return { ...state, [key]: next };
      });
    }, 16);

    return () => window.clearInterval(timer);
  }, [open, currentIndex, done]);

  useEffect(() => {
    if (!open || done) return;
    const key = AI_KEYS[currentIndex];
    if (key && texts[key].length >= AI_DRAFTS[key].length) {
      const t = window.setTimeout(() => setCurrentIndex((index) => index + 1), 220);
      return () => window.clearTimeout(t);
    }
    if (!key) setDone(true);
  }, [texts, currentIndex, open, done]);

  if (!open || !project) return null;

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
                读取 {project.name} 的代码 · README · Git 历史
              </div>
            </div>
          </div>
          <IconButton name="x" title="关闭" onClick={onClose} />
        </header>

        <div className="flex-1 space-y-3 overflow-auto p-4">
          {AI_KEYS.map((key, index) => {
            const active = index === currentIndex && !done;
            const complete = texts[key].length >= AI_DRAFTS[key].length;
            return (
              <section
                key={key}
                className="rounded-[10px] border p-4"
                style={{
                  borderColor: active ? "var(--primary-ring)" : "var(--border)",
                  background: active ? "var(--surface-elevated)" : "var(--surface)",
                  opacity: index > currentIndex ? 0.54 : 1,
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
                      采纳
                    </Button>
                  ) : null}
                </div>
                <p className="min-h-10 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {texts[key]}
                  {active ? <span className="ml-0.5 inline-block h-4 w-1 animate-[caretBlink_1s_infinite] bg-[var(--primary)] align-[-2px]" /> : null}
                </p>
              </section>
            );
          })}
        </div>

        <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-3">
          <div className="text-xs text-[var(--text-tertiary)]">
            {done ? "生成完成" : "正在生成..."}
          </div>
          <Button
            variant="primary"
            disabled={!done}
            onClick={() => {
              AI_KEYS.forEach((key) => onAdopt(key, texts[key] || AI_DRAFTS[key]));
              onToast("已全部采纳并保存", "success");
              onClose();
            }}
          >
            <AppIcon name="check" size={15} />
            全部采纳并保存
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
}

export function AddProjectModal({ open, onClose, onToast }: AddProjectModalProps) {
  const [scanning, setScanning] = useState(false);
  const [count, setCount] = useState(0);
  const done = count >= 7;

  useEffect(() => {
    if (!open) {
      setScanning(false);
      setCount(0);
    }
  }, [open]);

  useEffect(() => {
    if (!scanning || done) return;
    const timer = window.setInterval(() => setCount((value) => Math.min(7, value + 1)), 120);
    return () => window.clearInterval(timer);
  }, [scanning, done]);

  if (!open) return null;

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
                defaultValue="~/dev"
              />
              <Button size="sm" variant="secondary">
                浏览
              </Button>
            </div>
          </label>

          <div className="flex min-h-[96px] items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg)] text-center">
            {scanning ? (
              <div>
                <div className="mono text-[24px] font-bold text-[var(--text-primary)]">{count}</div>
                <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                  {done ? "扫描完成" : "正在扫描项目..."}
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-[var(--text-tertiary)]">点击「扫描」预览将发现的项目</div>
            )}
          </div>
        </div>

        <footer className="panel-row border-t border-[var(--border)] bg-[var(--surface-elevated)] px-5 py-4">
          <Button
            variant="ghost"
            onClick={() => {
              setScanning(true);
              setCount(0);
            }}
            disabled={scanning && !done}
          >
            <AppIcon
              name="sparkles"
              size={15}
              className={scanning && !done ? "animate-[spin_1s_linear_infinite]" : ""}
            />
            扫描
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              variant="primary"
              disabled={!done}
              onClick={() => {
                onToast(`已导入 ${count} 个项目`, "success");
                onClose();
              }}
            >
              <AppIcon name="plus" size={15} />
              导入 {count || 0} 个项目
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
