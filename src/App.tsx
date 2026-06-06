import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppIcon, type IconName } from "./components/AppIcon";
import { Button, IconButton, TagChip, Toast } from "./components/Primitives";
import { AddProjectModal, AIDrawer, DiffDrawer } from "./features/Drawers";
import { Overview } from "./features/Overview";
import { ProjectDetail } from "./features/ProjectDetail";
import { Settings } from "./features/Settings";
import { computeCompleteness } from "./lib/completeness";
import { COMMIT_RANK, OPENED_RANK, PROJECTS } from "./lib/mock-data";
import type { SortKey } from "./lib/types";
import { useMemoirStore } from "./store/useMemoirStore";

const SORTS: Array<{ id: SortKey; label: string; icon: IconName }> = [
  { id: "opened", label: "最近打开", icon: "clock" },
  { id: "commit", label: "最近提交", icon: "gitCommit" },
  { id: "completeness", label: "完整度", icon: "layers" },
  { id: "name", label: "名称", icon: "sort" },
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
        const status = await invoke<string>("get_memoir_status");
        store.setRuntimeStatus(status);
      } catch (error) {
        console.log("[DEBUG][loadRuntimeStatus]", { error }, new Date().toISOString());
        store.setRuntimeStatus("浏览器预览模式");
      }
    }

    void loadRuntimeStatus();
  }, [store.setRuntimeStatus]);

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

  const allTags = useMemo(() => [...new Set(PROJECTS.flatMap((project) => project.tags))], []);
  const selected = PROJECTS.find((project) => project.id === store.selectedId) ?? null;
  const hasFilters =
    store.status !== "all" || store.activeTags.length > 0 || store.search.trim().length > 0;

  const filteredProjects = useMemo(() => {
    const list = PROJECTS.filter((project) => {
      if (store.status !== "all" && project.status !== store.status) return false;
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
          ...project.tags,
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (store.sort === "opened") return OPENED_RANK.indexOf(a.id) - OPENED_RANK.indexOf(b.id);
      if (store.sort === "commit") return COMMIT_RANK.indexOf(a.id) - COMMIT_RANK.indexOf(b.id);
      if (store.sort === "completeness") {
        return (
          computeCompleteness(b, store.archives[b.id]) -
          computeCompleteness(a, store.archives[a.id])
        );
      }
      return a.name.localeCompare(b.name);
    });
  }, [store.status, store.activeTags, store.search, store.sort, store.archives]);

  return (
    <div className="app-viewport min-h-screen">
      <div className="desktop-window">
        <aside className="sidebar">
          <div className="traffic-row">
            <TrafficLights />
          </div>
          <div className="wordmark">
            <div className="wordmark-mark">
              <AppIcon name="bookOpen" size={15} />
            </div>
            <span className="text-base font-bold tracking-normal">Memoir</span>
          </div>

          <div className="sidebar-scroll">
            <NavItem
              icon="grid"
              label="项目库"
              count={PROJECTS.length}
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

            <SidebarBlock title="排序">
              <div className="flex flex-col gap-0.5">
                {SORTS.map((sort) => (
                  <button
                    key={sort.id}
                    className="focus-ring flex h-[30px] items-center gap-2.5 rounded-[7px] border-0 bg-transparent px-2 text-left text-[12.5px] transition hover:bg-[var(--surface-hover)]"
                    style={{
                      background: store.sort === sort.id ? "var(--surface-hover)" : undefined,
                      color: store.sort === sort.id ? "var(--text-primary)" : "var(--text-secondary)",
                      fontWeight: store.sort === sort.id ? 650 : 450,
                    }}
                    onClick={() => store.setSort(sort.id)}
                  >
                    <AppIcon
                      name={sort.icon}
                      size={14}
                      color={store.sort === sort.id ? "var(--primary)" : "var(--text-tertiary)"}
                    />
                    <span className="hide-mobile-sidebar">{sort.label}</span>
                    {store.sort === sort.id ? (
                      <AppIcon className="hide-mobile-sidebar ml-auto" name="check" size={13} color="var(--primary)" />
                    ) : null}
                  </button>
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
                onSaveArchive={(key, text) => store.saveArchive(selected.id, key, text)}
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
          project={selected}
          onClose={store.closeDiff}
        />
        <AIDrawer
          open={store.aiOpen}
          project={selected}
          onClose={() => store.setAiOpen(false)}
          onAdopt={(key, text) => selected && store.saveArchive(selected.id, key, text)}
          onToast={store.showToast}
        />
        <AddProjectModal
          open={store.addOpen}
          onClose={() => store.setAddOpen(false)}
          onToast={store.showToast}
        />
        <Toast toast={store.toast} />
      </div>
    </div>
  );
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
        <div className="flex-1" />
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
      <div className="flex-1" />
    </header>
  );
}

function TrafficLights() {
  const [hover, setHover] = useState(false);
  const lights = [
    { color: "var(--traffic-close)", label: "×" },
    { color: "var(--traffic-minimize)", label: "–" },
    { color: "var(--traffic-zoom)", label: "+" },
  ];

  return (
    <div
      className="flex items-center gap-2"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {lights.map((item) => (
        <span key={item.color} className="traffic-light" style={{ background: item.color }}>
          {hover ? item.label : ""}
        </span>
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

function SidebarBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="sidebar-label">{title}</div>
      {children}
    </section>
  );
}
