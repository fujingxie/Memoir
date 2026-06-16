import { AppIcon } from "../components/AppIcon";
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
import { categoryLabel } from "../lib/categories";
import { computeCompleteness } from "../lib/completeness";
import { openPersistedProjectDir, openPersistedProjectEditor } from "../lib/projects-api";
import type { ArchiveState, Project, ViewMode } from "../lib/types";

interface OverviewProps {
  projects: Project[];
  loading: boolean;
  view: ViewMode;
  scopeLabel: string;
  archives: Record<string, ArchiveState>;
  hasActiveFilters: boolean;
  onOpen: (id: string) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onClearFilters: () => void;
  onAdd: () => void;
}

export function Overview({
  projects,
  loading,
  view,
  scopeLabel,
  archives,
  hasActiveFilters,
  onOpen,
  onToast,
  onClearFilters,
  onAdd,
}: OverviewProps) {
  const pinned = projects.filter((project) => project.pinned);
  const rest = projects.filter((project) => !project.pinned);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="section-label">已置顶</div>
        <div className="project-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={hasActiveFilters ? "search" : "folder"}
        title={hasActiveFilters ? "没有匹配项目" : "还没有项目"}
        body={hasActiveFilters ? "当前筛选条件没有命中任何项目。" : "添加扫描目录后, Memoir 会发现其中的代码仓库。"}
        action={
          hasActiveFilters ? (
            <Button variant="secondary" onClick={onClearFilters}>
              清除筛选
            </Button>
          ) : (
            <Button variant="primary" onClick={onAdd}>
              <AppIcon name="plus" size={15} />
              添加扫描目录
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {pinned.length > 0 ? (
        <ProjectSection
          title="已置顶"
          projects={pinned}
          view={view}
          archives={archives}
          onOpen={onOpen}
          onToast={onToast}
        />
      ) : null}
      <ProjectSection
        title={`${scopeLabel} · ${rest.length}`}
        projects={rest}
        view={view}
        archives={archives}
        onOpen={onOpen}
        onToast={onToast}
      />
    </div>
  );
}

function ProjectSection({
  title,
  projects,
  view,
  archives,
  onOpen,
  onToast,
}: {
  title: string;
  projects: Project[];
  view: ViewMode;
  archives: Record<string, ArchiveState>;
  onOpen: (id: string) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  return (
    <section className="space-y-3">
      <div className="section-label flex items-center gap-2">
        {title.includes("置顶") ? <AppIcon name="tag" size={12} /> : <AppIcon name="grid" size={12} />}
        {title}
      </div>
      <div className={view === "grid" ? "project-grid" : "project-list"}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            archive={archives[project.id]}
            list={view === "list"}
            onOpen={() => onOpen(project.id)}
            onToast={onToast}
          />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  archive,
  list,
  onOpen,
  onToast,
}: {
  project: Project;
  archive: ArchiveState;
  list: boolean;
  onOpen: () => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
}) {
  const completeness = computeCompleteness(project, archive);
  const low = completeness < 40;
  const summary = toCardSummary(project.description);
  const activityTime = activityTimeLabel(project);
  const openDirectory = async () => {
    try {
      const message = await openPersistedProjectDir(project.id);
      onToast(message ?? `已打开 ${project.path}`, "success");
    } catch (error) {
      console.log("[DEBUG][ProjectCard.openDirectory]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "打开目录失败", "error");
    }
  };
  const openEditor = async () => {
    try {
      const message = await openPersistedProjectEditor(project.id);
      onToast(message ?? `已用默认编辑器打开 ${project.name}`, "success");
    } catch (error) {
      console.log("[DEBUG][ProjectCard.openEditor]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "编辑器打开失败", "error");
    }
  };

  if (list) {
    return (
      <article className={`project-card list ${low ? "low" : ""}`} onClick={onOpen}>
        <div className="project-list-identity">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <LangDot lang={project.lang} />
              <h3 className="truncate text-[15.5px] font-bold text-[var(--text-primary)]">{project.name}</h3>
              <span className="category-chip">{categoryLabel(project.category)}</span>
              {project.pinned ? <AppIcon name="tag" size={12} color="var(--text-tertiary)" /> : null}
            </div>
            <div className="mono mt-1 truncate text-[11.5px] text-[var(--text-tertiary)]">{project.path}</div>
          </div>
          <CompletenessRing value={completeness} size={44} />
        </div>

        <p className={`project-list-summary ${summary ? "" : "empty"}`}>
          {summary || "还没有档案 — 用 AI 补一份留痕"}
        </p>

        <div className="project-list-meta">
          <div className="project-list-tags">
            {project.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag}>{tag}</TagChip>
            ))}
          </div>
          <div className="project-list-state">
            <GitBadge git={project.git} />
            <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
              <AppIcon name="clock" size={13} />
              <span className="truncate">{activityTime}</span>
            </span>
            <StatusBadge status={project.status} />
          </div>
        </div>

        <span
          className="project-list-actions"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <IconButton
            name="folderOpen"
            title="在访达打开"
            onClick={() => void openDirectory()}
          />
          <IconButton
            name="terminal"
            title="用编辑器打开"
            onClick={() => void openEditor()}
          />
        </span>
      </article>
    );
  }

  return (
    <article className={`project-card ${low ? "low" : ""}`} onClick={onOpen}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <LangDot lang={project.lang} />
              <h3 className="truncate text-[15.5px] font-bold text-[var(--text-primary)]">{project.name}</h3>
              <span className="category-chip">{categoryLabel(project.category)}</span>
              {project.pinned ? <AppIcon name="tag" size={12} color="var(--text-tertiary)" /> : null}
            </div>
            <div className="mono mt-1 truncate text-[11.5px] text-[var(--text-tertiary)]">{project.path}</div>
          </div>
          <CompletenessRing value={completeness} size={46} />
        </div>

        <p className={`project-card-summary ${summary ? "" : "empty"}`}>
          {summary || "还没有档案 — 用 AI 补一份留痕"}
        </p>

        <div className="chip-row">
          {project.tags.slice(0, 3).map((tag) => (
            <TagChip key={tag}>{tag}</TagChip>
          ))}
        </div>
      </div>

      <div className="card-footer">
        <GitBadge git={project.git} />
        <span className="inline-flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-tertiary)]">
          <AppIcon name="clock" size={13} />
          <span className="truncate">{activityTime}</span>
        </span>
        <span className="status-on-hover ml-auto">
          <StatusBadge status={project.status} />
        </span>
        <span
          className="quick-actions"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <IconButton
            name="folderOpen"
            title="在访达打开"
            onClick={() => void openDirectory()}
          />
          <IconButton
            name="terminal"
            title="用编辑器打开"
            onClick={() => void openEditor()}
          />
        </span>
      </div>
    </article>
  );
}

function activityTimeLabel(project: Project) {
  return project.git.tracked ? project.lastCommit : project.lastOpened;
}

function toCardSummary(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function SkeletonCard() {
  return (
    <div className="project-card cursor-default">
      <div className="flex justify-between">
        <div className="space-y-2">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-3 w-48" />
        </div>
        <div className="skeleton h-[46px] w-[46px] rounded-full" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
      </div>
      <div className="mt-auto flex gap-2 pt-8">
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}
