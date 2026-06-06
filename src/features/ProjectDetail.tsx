import { useMemo, useState } from "react";
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
import { archiveFilledCount, computeCompleteness } from "../lib/completeness";
import type { ArchiveKey, ArchiveState, CommitInfo, DetailTab, FileNode, Project } from "../lib/types";

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

interface ProjectDetailProps {
  project: Project;
  archive: ArchiveState;
  tab: DetailTab;
  onTab: (tab: DetailTab) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onOpenDiff: (commit: CommitInfo | null, mode?: "commit" | "working") => void;
  onOpenAI: () => void;
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
  onSaveArchive,
}: ProjectDetailProps) {
  const completeness = computeCompleteness(project, archive);
  const filled = archiveFilledCount(archive);
  const archiveIncomplete = filled < 4;

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
          <Button variant="secondary" onClick={() => onToast(`编辑器打开 ${project.name}`, "success")}>
            <AppIcon name="terminal" size={15} />
            编辑器
          </Button>
          <Button variant="primary" onClick={() => onToast(`已打开 ${project.path}`, "success")}>
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
      {tab === "files" ? <FilesTab project={project} /> : null}
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
            {project.techStack.map((item) => (
              <TagChip key={item}>{item}</TagChip>
            ))}
          </div>
        </div>

        <div className="panel pad">
          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <AppIcon name="gitCommit" size={14} />
            最近活动
          </div>
          <div className="truncate text-[13.5px] font-medium">{project.lastCommitMsg || "暂无提交"}</div>
          <div className="mono mt-2 text-xs text-[var(--text-tertiary)]">
            {project.lastCommitHash || "no-git"} · {project.lastCommit}
          </div>
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

function FilesTab({ project }: { project: Project }) {
  const firstFile = findFirstFile(project.files) ?? "README.md";
  const [selected, setSelected] = useState(firstFile);

  const code = useMemo(() => previewCode(selected, project), [selected, project]);

  return (
    <div className="tab-content">
      <div className="split-pane">
        <div className="tree-pane">
          <FileTree node={project.files} selected={selected} onSelect={setSelected} />
        </div>
        <div className="code-pane">
          <div className="panel-row border-b border-[var(--border)] px-4 py-3">
            <div className="mono flex min-w-0 items-center gap-2 truncate text-[12.5px]">
              <AppIcon name="fileCode" size={15} color="var(--accent)" />
              {selected}
            </div>
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[11px] text-[var(--text-tertiary)]">
              只读
            </span>
          </div>
          <div className="code-body mono">
            {code.map((line, index) => (
              <div className="code-line" key={`${line}-${index}`}>
                <span>{index + 1}</span>
                <span>{line || " "}</span>
              </div>
            ))}
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
  const active = selected === node.name;

  return (
    <div>
      <button
        className="focus-ring flex h-7 w-full items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-[12.5px] transition hover:bg-[var(--surface-hover)]"
        style={{ paddingLeft: 8 + level * 14, color: active ? "var(--primary)" : "var(--text-secondary)" }}
        onClick={() => (isFolder ? setOpen(!open) : onSelect(node.name))}
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
              key={`${node.name}-${child.name}`}
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
  onOpenDiff: (commit: CommitInfo | null, mode?: "commit" | "working") => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  if (!project.git.tracked) {
    return (
      <div className="tab-content">
        <EmptyState
          icon="gitBranch"
          title="这个项目还不是 Git 仓库"
          body="初始化后, Memoir 就能读取分支、提交历史和工作区状态。"
          action={
            <div className="space-y-4">
              <pre className="mono rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-xs text-[var(--text-secondary)]">
                git init && git add -A
              </pre>
              <Button variant="primary" onClick={() => onToast("Git 初始化将在 T6 接入真实命令", "info")}>
                初始化 Git 仓库
              </Button>
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
          <GitMeta label="当前分支" value={project.git.branch} icon="gitBranch" />
          <GitMeta label="远程" value={project.git.remote || "未设置"} icon="globe" />
          <div>
            <div className="mb-2 text-[11px] text-[var(--text-tertiary)]">状态</div>
            <GitBadge git={project.git} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => onToast("Pull 命令将在 T6 接入", "info")}>
            <AppIcon name="arrowDown" size={15} />
            Pull
          </Button>
          <Button variant="secondary" onClick={() => onToast("Push 命令将在 T6 接入", "info")}>
            <AppIcon name="arrowUp" size={15} />
            Push
          </Button>
          <Button variant="primary" onClick={() => onToast("Commit 弹窗将在 T6 接入", "info")}>
            <AppIcon name="gitCommit" size={15} />
            Commit
          </Button>
        </div>
      </div>

      {project.git.state === "dirty" ? (
        <button className="warn-strip w-full text-left" onClick={() => onOpenDiff(project.commits[0] ?? null, "working")}>
          <AppIcon name="alert" size={20} color="var(--warning)" />
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold">有 {project.git.changes} 处未提交改动</div>
            <div className="text-xs text-[var(--text-secondary)]">点击查看工作区 Diff</div>
          </div>
          <AppIcon name="chevronR" size={16} />
        </button>
      ) : null}

      <div>
        <div className="section-label mb-3">提交历史 · {project.commits.length}</div>
        <div className="panel overflow-hidden">
          {project.commits.map((commit) => (
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
  return (
    <div className="tab-content">
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => onToast("添加资料命令将在 T9 接入", "info")}>
          <AppIcon name="plus" size={15} />
          添加
        </Button>
      </div>
      {project.docs.length === 0 ? (
        <EmptyState
          icon="link"
          title="还没有关联资料"
          body="可以关联本地文档、设计稿、部署控制台或历史对话。"
        />
      ) : (
        <div className="panel overflow-hidden">
          {project.docs.map((doc) => (
            <button
              key={`${doc.type}-${doc.name}`}
              className="doc-row flex w-full items-center gap-3 border-0 border-b border-[var(--border)] bg-transparent px-4 py-3 text-left last:border-b-0"
              onClick={() => onToast(`打开 ${doc.name}`, "success")}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--accent)]">
                <AppIcon name={doc.type === "file" ? "file" : "external"} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{doc.name}</span>
                <span className="mono block truncate text-xs text-[var(--text-tertiary)]">{doc.meta}</span>
              </span>
              <AppIcon name={doc.type === "file" ? "folderOpen" : "external"} size={16} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
