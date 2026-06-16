import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppIcon, type IconName } from "./components/AppIcon";
import { Button, IconButton, TagChip, Toast } from "./components/Primitives";
import { AddProjectModal, AIDrawer, DiffDrawer } from "./features/Drawers";
import { Overview } from "./features/Overview";
import { ProjectDetail } from "./features/ProjectDetail";
import { Settings } from "./features/Settings";
import { PROJECT_CATEGORIES, categoryLabel } from "./lib/categories";
import { computeCompleteness } from "./lib/completeness";
import { initMemoirDatabase } from "./lib/database";
import { COMMIT_RANK, OPENED_RANK, PROJECTS } from "./lib/mock-data";
import {
  canUsePersistedProject,
  isTauriRuntime,
  listPersistedProjects,
  readPersistedArchive,
  savePersistedArchive,
  setPersistedProjectCategory,
} from "./lib/projects-api";
import type { ArchiveKey, ArchiveState, CategoryKey, FocusKey, Project, SortKey } from "./lib/types";
import { useMemoirStore } from "./store/useMemoirStore";

const SORTS: Array<{ id: SortKey; label: string; icon: IconName }> = [
  { id: "opened", label: "最近打开", icon: "clock" },
  { id: "commit", label: "最近提交", icon: "gitCommit" },
  { id: "completeness", label: "完整度", icon: "layers" },
  { id: "name", label: "名称", icon: "sort" },
];

const FOCUS_ITEMS: Array<{ id: FocusKey; label: string; icon: IconName }> = [
  { id: "needsArchive", label: "需补档案", icon: "alert" },
  { id: "dirty", label: "有未提交", icon: "gitCommit" },
  { id: "noGithubRemote", label: "未上传 GitHub", icon: "globe" },
  { id: "nonGit", label: "非 Git 项目", icon: "gitBranch" },
  { id: "stale", label: "长期未打开", icon: "clock" },
  { id: "noDocs", label: "无关联资料", icon: "link" },
];

export function App() {
  const store = useMemoirStore();
  const toastTimer = useRef<number>();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", store.theme);
  }, [store.theme]);

  useEffect(() => {
    const timer = window.setTimeout(() => store.setLoading(false), 900);
    return () => window.clearTimeout(timer);
  }, [store.setLoading]);

  useEffect(() => {
    if (!store.toast) return;
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => store.clearToast(), 2600);
    return () => window.clearTimeout(toastTimer.current);
  }, [store.toast, store.clearToast]);

  useEffect(() => {
    async function loadRuntimeStatus() {
      try {
        const [rustStatus, dbStatus] = await Promise.all([
          invoke<string>("get_memoir_status"),
          initMemoirDatabase(),
        ]);
        store.setRuntimeStatus(`${rustStatus} · ${dbStatus}`);
        if (isTauriRuntime()) {
          const projects = await listPersistedProjects();
          if (projects) store.setProjects(projects);
        }
      } catch (error) {
        console.log("[DEBUG][loadRuntimeStatus]", { error }, new Date().toISOString());
        store.setRuntimeStatus("浏览器预览模式");
      }
    }

    void loadRuntimeStatus();
  }, [store.setRuntimeStatus, store.setProjects]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (store.diff.open) store.closeDiff();
      if (store.aiOpen) store.setAiOpen(false);
      if (store.addOpen) store.setAddOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  const allTags = useMemo(
    () => [...new Set(store.projects.flatMap((project) => project.tags))],
    [store.projects],
  );
  const focusItems = useMemo(
    () =>
      FOCUS_ITEMS.map((item) => ({
        ...item,
        count: store.projects.filter((project) => matchesFocus(project, item.id, store.archives)).length,
      })),
    [store.projects, store.archives],
  );
  const categoryItems = useMemo(
    () =>
      PROJECT_CATEGORIES.map((item) => ({
        ...item,
        count: store.projects.filter((project) => project.category === item.id).length,
      })),
    [store.projects],
  );
  const activeFocusLabel = FOCUS_ITEMS.find((item) => item.id === store.focus)?.label ?? null;
  const activeCategoryLabel =
    store.category === "all" ? null : PROJECT_CATEGORIES.find((item) => item.id === store.category)?.label;
  const selected = store.projects.find((project) => project.id === store.selectedId) ?? null;
  const hasFilters =
    store.status !== "all" ||
    store.category !== "all" ||
    store.focus !== null ||
    store.activeTags.length > 0 ||
    store.search.trim().length > 0;

  useEffect(() => {
    if (!selected || !canUsePersistedProject(selected)) return;
    let cancelled = false;
    const projectId = selected.id;

    async function loadArchive() {
      try {
        const record = await readPersistedArchive(projectId);
        if (!record || cancelled) return;
        store.setArchive(projectId, record.archive, record.completeness);
      } catch (error) {
        console.log("[DEBUG][loadArchive]", { id: projectId, error }, new Date().toISOString());
        if (!cancelled) store.showToast("读取项目档案失败", "error");
      }
    }

    void loadArchive();
    return () => {
      cancelled = true;
    };
  }, [selected?.id, store.setArchive, store.showToast]);

  const saveArchiveSection = async (projectId: string, key: ArchiveKey, text: string) => {
    const project = store.projects.find((item) => item.id === projectId);
    const currentArchive = store.archives[projectId] ?? project?.archive;
    if (!currentArchive) return;

    const archive: ArchiveState = {
      ...currentArchive,
      [key]: { filled: text.trim().length > 0, text },
    };

    store.saveArchive(projectId, key, text);
    if (!project || !canUsePersistedProject(project)) return;

    try {
      const record = await savePersistedArchive(projectId, archive);
      if (!record) return;
      store.setArchive(projectId, record.archive, record.completeness);
      store.showToast("项目档案已保存", "success");
    } catch (error) {
      console.log("[DEBUG][saveArchiveSection]", { projectId, key, error }, new Date().toISOString());
      store.showToast("保存项目档案失败", "error");
    }
  };

  const saveArchiveDraft = async (projectId: string, archive: ArchiveState) => {
    const project = store.projects.find((item) => item.id === projectId);
    store.setArchive(projectId, archive);

    if (!project || !canUsePersistedProject(project)) {
      store.showToast("已保存 AI 初稿", "success");
      return;
    }

    try {
      const record = await savePersistedArchive(projectId, archive);
      if (!record) return;
      store.setArchive(projectId, record.archive, record.completeness);
      store.showToast("AI 初稿已保存为项目档案", "success");
    } catch (error) {
      console.log("[DEBUG][saveArchiveDraft]", { projectId, error }, new Date().toISOString());
      store.showToast("保存 AI 初稿失败", "error");
    }
  };

  const changeProjectCategory = async (projectId: string, category: CategoryKey) => {
    const project = store.projects.find((item) => item.id === projectId);
    store.setProjectCategory(projectId, category);

    if (!project || !canUsePersistedProject(project)) {
      store.showToast(`项目分类已设为 ${categoryLabel(category)}`, "success");
      return;
    }

    try {
      const updated = await setPersistedProjectCategory(projectId, category);
      if (updated) store.setProjectCategory(projectId, updated.category);
      store.showToast(`项目分类已设为 ${categoryLabel(category)}`, "success");
    } catch (error) {
      console.log("[DEBUG][changeProjectCategory]", { projectId, category, error }, new Date().toISOString());
      store.setProjectCategory(projectId, project.category);
      store.showToast(error instanceof Error ? error.message : "更新项目分类失败", "error");
    }
  };

  const filteredProjects = useMemo(() => {
    const list = store.projects.filter((project) => {
      if (store.status !== "all" && project.status !== store.status) return false;
      if (store.category !== "all" && project.category !== store.category) return false;
      if (store.focus && !matchesFocus(project, store.focus, store.archives)) return false;
      if (
        store.activeTags.length > 0 &&
        !store.activeTags.some((tag) => project.tags.includes(tag))
      ) {
        return false;
      }
      if (store.search.trim()) {
        const query = store.search.toLowerCase();
        const haystack = [
          project.name,
          project.path,
          project.description,
          categoryLabel(project.category),
          ...project.tags,
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (store.sort === "opened") {
        const mockOrder = compareMockRank(a.id, b.id, OPENED_RANK);
        if (mockOrder !== null) return mockOrder;
        return compareDateDesc(a.lastOpenedAt ?? a.createdAt, b.lastOpenedAt ?? b.createdAt);
      }
      if (store.sort === "commit") {
        const mockOrder = compareMockRank(a.id, b.id, COMMIT_RANK);
        if (mockOrder !== null) return mockOrder;
        return compareDateDesc(a.lastCommitAt, b.lastCommitAt);
      }
      if (store.sort === "completeness") {
        return (
          computeCompleteness(b, store.archives[b.id]) -
          computeCompleteness(a, store.archives[a.id])
        );
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    store.projects,
    store.status,
    store.category,
    store.focus,
    store.activeTags,
    store.search,
    store.sort,
    store.archives,
  ]);

  return (
    <div className="app-viewport min-h-screen">
      <div className="desktop-window">
        <aside className="sidebar">
          <div className="traffic-row">
            <TrafficLights />
          </div>
          <div className="wordmark" data-tauri-drag-region="">
            <div className="wordmark-mark">
              <AppIcon name="bookOpen" size={15} />
            </div>
            <span className="text-base font-bold tracking-normal">Memoir</span>
          </div>

          <div className="sidebar-scroll">
            <NavItem
              icon="grid"
              label="项目库"
              count={store.projects.length}
              active={store.route !== "settings"}
              onClick={store.goOverview}
            />

            <SidebarBlock title="状态">
              <div className="hide-mobile-sidebar flex gap-1 px-1.5">
                {[
                  { id: "all", label: "全部" },
                  { id: "active", label: "活跃" },
                  { id: "archived", label: "归档" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className="focus-ring h-7 flex-1 cursor-pointer rounded-[7px] border text-xs font-semibold transition"
                    style={{
                      background: store.status === item.id ? "var(--primary-soft)" : "transparent",
                      borderColor: store.status === item.id ? "var(--primary-ring)" : "var(--border)",
                      color: store.status === item.id ? "var(--primary)" : "var(--text-secondary)",
                    }}
                    onClick={() => store.setStatus(item.id as typeof store.status)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </SidebarBlock>

            <SidebarBlock title="分类">
              <div className="flex flex-col gap-0.5">
                {categoryItems.map((item) => (
                  <FocusNavItem
                    key={item.id}
                    icon="tag"
                    label={item.label}
                    count={item.count}
                    active={store.category === item.id}
                    onClick={() => store.setCategory(store.category === item.id ? "all" : item.id)}
                  />
                ))}
              </div>
            </SidebarBlock>

            <SidebarBlock title="关注">
              <div className="flex flex-col gap-0.5">
                {focusItems.map((item) => (
                  <FocusNavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    count={item.count}
                    active={store.focus === item.id}
                    onClick={() => store.setFocus(store.focus === item.id ? null : item.id)}
                  />
                ))}
              </div>
            </SidebarBlock>

            <SidebarBlock title="标签">
              <div className="hide-mobile-sidebar chip-row px-1.5">
                {allTags.map((tag) => (
                  <TagChip
                    key={tag}
                    active={store.activeTags.includes(tag)}
                    onClick={() => store.toggleTag(tag)}
                  >
                    {tag}
                  </TagChip>
                ))}
              </div>
            </SidebarBlock>
          </div>

          <div className="flex items-center gap-1.5 border-t border-[var(--border)] p-2.5">
            <button
              className="focus-ring flex h-[34px] flex-1 items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-[13px] font-semibold transition hover:bg-[var(--surface-hover)]"
              style={{
                background: store.route === "settings" ? "var(--primary-soft)" : undefined,
                color: store.route === "settings" ? "var(--primary)" : "var(--text-secondary)",
              }}
              onClick={() => store.setRoute("settings")}
            >
              <AppIcon name="settings" size={16} />
              <span className="hide-mobile-sidebar">设置</span>
            </button>
            <IconButton
              name={store.theme === "dark" ? "sun" : "moon"}
              title={store.theme === "dark" ? "切换浅色" : "切换深色"}
              onClick={() => store.setTheme(store.theme === "dark" ? "light" : "dark")}
            />
          </div>
        </aside>

        <main className="main">
          <Topbar selectedName={selected?.name ?? null} />

          <div className={store.route === "detail" ? "content-detail" : "content-scroll"}>
            {store.route === "overview" ? (
              <div className="overview-shell">
                <Overview
                  projects={filteredProjects}
                  loading={store.loading}
                  view={store.view}
                  scopeLabel={activeFocusLabel ?? activeCategoryLabel ?? "全部项目"}
                  archives={store.archives}
                  hasActiveFilters={hasFilters}
                  onOpen={store.openProject}
                  onToast={store.showToast}
                  onClearFilters={store.clearFilters}
                  onAdd={() => store.setAddOpen(true)}
                />
              </div>
            ) : null}

            {store.route === "detail" && selected ? (
              <ProjectDetail
                project={selected}
                archive={store.archives[selected.id]}
                tab={store.tab}
                onTab={store.setTab}
                onToast={store.showToast}
                onOpenDiff={store.openDiff}
                onOpenAI={() => store.setAiOpen(true)}
                onCategoryChange={(category) => void changeProjectCategory(selected.id, category)}
                onSaveArchive={(key, text) => void saveArchiveSection(selected.id, key, text)}
              />
            ) : null}

            {store.route === "settings" ? (
              <Settings
                theme={store.theme}
                runtimeStatus={store.runtimeStatus}
                onTheme={store.setTheme}
                onToast={store.showToast}
                onAdd={() => store.setAddOpen(true)}
              />
            ) : null}
          </div>
        </main>

        <DiffDrawer
          open={store.diff.open}
          commit={store.diff.commit}
          mode={store.diff.mode}
          file={store.diff.file}
          project={selected}
          onClose={store.closeDiff}
        />
        <AIDrawer
          open={store.aiOpen}
          project={selected}
          onClose={() => store.setAiOpen(false)}
          onAdopt={(key, text) => selected && void saveArchiveSection(selected.id, key, text)}
          onAdoptAll={(archive) => selected && void saveArchiveDraft(selected.id, archive)}
          onToast={store.showToast}
        />
        <AddProjectModal
          open={store.addOpen}
          onClose={() => store.setAddOpen(false)}
          onToast={store.showToast}
          onProjectsChange={store.setProjects}
        />
        <Toast toast={store.toast} />
      </div>
    </div>
  );
}

function compareMockRank(a: string, b: string, rank: string[]) {
  const ai = rank.indexOf(a);
  const bi = rank.indexOf(b);
  if (ai === -1 && bi === -1) return null;
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function compareDateDesc(a?: string | null, b?: string | null) {
  const at = a ? new Date(a.includes("T") ? a : a.replace(" ", "T") + "Z").getTime() : 0;
  const bt = b ? new Date(b.includes("T") ? b : b.replace(" ", "T") + "Z").getTime() : 0;
  return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
}

function matchesFocus(
  project: Project,
  focus: FocusKey,
  archives: Record<string, ArchiveState>,
) {
  if (focus === "needsArchive") return computeCompleteness(project, archives[project.id]) < 100;
  if (focus === "dirty") return project.git.state === "dirty";
  if (focus === "noGithubRemote") return project.git.tracked && !hasGithubRemote(project.git.remote);
  if (focus === "nonGit") return !project.git.tracked;
  if (focus === "stale") return isStaleProject(project);
  return documentCount(project) === 0;
}

function hasGithubRemote(remote: string) {
  return remote.trim().toLowerCase().includes("github.com");
}

function documentCount(project: Project) {
  return project.docsCount ?? project.docs.length;
}

function isStaleProject(project: Project) {
  const timestamp = parseProjectDate(project.lastOpenedAt ?? project.createdAt);
  if (timestamp !== null) {
    return Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000;
  }

  const label = project.lastOpened.trim();
  if (/从未|半年|个月|上个月/.test(label)) return true;

  const days = label.match(/(\d+)\s*天前/);
  if (days) return Number(days[1]) >= 30;

  const weeks = label.match(/(\d+)\s*周前/);
  if (weeks) return Number(weeks[1]) >= 4;

  return false;
}

function parseProjectDate(value?: string | null) {
  if (!value) return null;
  const timestamp = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function Topbar({ selectedName }: { selectedName: string | null }) {
  const store = useMemoirStore();
  const isOverview = store.route === "overview";

  if (isOverview) {
    return (
      <header className="topbar">
        <label className="searchbox">
          <AppIcon name="search" size={15} color="var(--text-tertiary)" />
          <input
            value={store.search}
            onChange={(event) => store.setSearch(event.target.value)}
            placeholder="搜索项目、路径、标签…"
          />
          {store.search ? (
            <button className="flex border-0 bg-transparent" onClick={() => store.setSearch("")}>
              <AppIcon name="x" size={14} color="var(--text-tertiary)" />
            </button>
          ) : null}
          <kbd className="kbd mono">⌘K</kbd>
        </label>
        <div className="flex-1" data-tauri-drag-region="" />
        <SortSelect />
        <div className="flex gap-0.5 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] p-[3px]">
          <IconButton
            name="grid"
            title="网格"
            size={28}
            active={store.view === "grid"}
            onClick={() => store.setView("grid")}
          />
          <IconButton
            name="list"
            title="列表"
            size={28}
            active={store.view === "list"}
            onClick={() => store.setView("list")}
          />
        </div>
        <Button variant="primary" onClick={() => store.setAddOpen(true)}>
          <AppIcon name="plus" size={15} />
          添加项目
        </Button>
      </header>
    );
  }

  return (
    <header className="topbar">
      <Button variant="ghost" onClick={store.goOverview}>
        <span className="inline-flex items-center gap-1.5">
          <AppIcon className="rotate-180" name="chevronR" size={14} />
          返回
        </span>
      </Button>
      <div className="flex items-center gap-2 text-[13px] text-[var(--text-tertiary)]">
        <button className="border-0 bg-transparent" onClick={store.goOverview}>
          项目库
        </button>
        <AppIcon name="chevronR" size={13} />
        <span className="font-semibold text-[var(--text-primary)]">
          {store.route === "settings" ? "设置" : selectedName}
        </span>
      </div>
      <div className="flex-1" data-tauri-drag-region="" />
    </header>
  );
}

function SortSelect() {
  const store = useMemoirStore();
  const selectedSort = SORTS.find((sort) => sort.id === store.sort) ?? SORTS[0];

  return (
    <label className="sort-control">
      <AppIcon name={selectedSort.icon} size={14} color="var(--text-tertiary)" />
      <span className="hide-mobile-sidebar">排序:</span>
      <select
        aria-label="项目排序"
        value={store.sort}
        onChange={(event) => store.setSort(event.target.value as SortKey)}
      >
        {SORTS.map((sort) => (
          <option key={sort.id} value={sort.id}>
            {sort.label}
          </option>
        ))}
      </select>
      <AppIcon className="sort-control-chevron" name="chevronD" size={13} color="var(--text-tertiary)" />
    </label>
  );
}

function TrafficLights() {
  const [hover, setHover] = useState(false);
  const lights = [
    { action: "close", color: "var(--traffic-close)", label: "×", title: "关闭窗口" },
    { action: "minimize", color: "var(--traffic-minimize)", label: "–", title: "最小化窗口" },
    { action: "toggleMaximize", color: "var(--traffic-zoom)", label: "+", title: "最大化窗口" },
  ];

  const runWindowAction = async (action: (typeof lights)[number]["action"]) => {
    if (!isTauriRuntime()) return;

    try {
      const appWindow = getCurrentWindow();
      if (action === "close") await appWindow.close();
      if (action === "minimize") await appWindow.minimize();
      if (action === "toggleMaximize") await appWindow.toggleMaximize();
    } catch (error) {
      console.log("[DEBUG][TrafficLights.runWindowAction]", { action, error }, new Date().toISOString());
    }
  };

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {lights.map((item) => (
        <button
          key={item.action}
          type="button"
          className="traffic-light"
          style={{ background: item.color }}
          title={item.title}
          aria-label={item.title}
          onClick={(event) => {
            event.stopPropagation();
            void runWindowAction(item.action);
          }}
        >
          {hover ? item.label : ""}
        </button>
      ))}
    </div>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="focus-ring flex h-9 w-full items-center gap-2.5 rounded-lg border-0 px-2.5 text-[13.5px] font-bold transition hover:bg-[var(--surface-hover)]"
      style={{
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-primary)",
      }}
      onClick={onClick}
    >
      <AppIcon name={icon} size={16} />
      <span className="hide-mobile-sidebar">{label}</span>
      <span
        className="nav-count mono ml-auto rounded-full px-2 py-0.5 text-[11.5px]"
        style={{
          background: active ? "transparent" : "var(--surface-elevated)",
          color: active ? "var(--primary)" : "var(--text-tertiary)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function FocusNavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="focus-ring flex h-[31px] items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2 text-left text-[12.5px] transition hover:bg-[var(--surface-hover)]"
      style={{
        background: active ? "var(--surface-hover)" : undefined,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 650 : 450,
      }}
      onClick={onClick}
    >
      <AppIcon name={icon} size={14} color={active ? "var(--primary)" : "var(--text-tertiary)"} />
      <span className="hide-mobile-sidebar truncate">{label}</span>
      <span
        className="nav-count mono ml-auto rounded-full px-1.5 py-0.5 text-[11px]"
        style={{
          background: active ? "var(--primary-soft)" : "transparent",
          color: active ? "var(--primary)" : "var(--text-tertiary)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function SidebarBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="sidebar-label">{title}</div>
      {children}
    </section>
  );
}
