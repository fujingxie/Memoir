import { create } from "zustand";
import { cloneArchives } from "../lib/utils";
import { archiveCompleteness } from "../lib/completeness";
import { PROJECTS } from "../lib/mock-data";
import type {
  ArchiveKey,
  ArchiveState,
  CategoryKey,
  DetailTab,
  DiffState,
  FocusKey,
  Project,
  ProjectStatus,
  Route,
  SortKey,
  Theme,
  ToastState,
  ViewMode,
} from "../lib/types";

interface MemoirState {
  theme: Theme;
  route: Route;
  selectedId: string | null;
  tab: DetailTab;
  status: ProjectStatus | "all";
  category: CategoryKey | "all";
  focus: FocusKey | null;
  activeTags: string[];
  sort: SortKey;
  search: string;
  view: ViewMode;
  loading: boolean;
  toast: ToastState | null;
  diff: DiffState;
  aiOpen: boolean;
  addOpen: boolean;
  projects: Project[];
  archives: Record<string, ArchiveState>;
  runtimeStatus: string;
  setTheme: (theme: Theme) => void;
  setRoute: (route: Route) => void;
  openProject: (id: string) => void;
  goOverview: () => void;
  setTab: (tab: DetailTab) => void;
  setStatus: (status: ProjectStatus | "all") => void;
  setCategory: (category: CategoryKey | "all") => void;
  setFocus: (focus: FocusKey | null) => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setSort: (sort: SortKey) => void;
  setSearch: (search: string) => void;
  setView: (view: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
  clearToast: () => void;
  openDiff: (commit: DiffState["commit"], mode?: DiffState["mode"], file?: string | null) => void;
  closeDiff: () => void;
  setAiOpen: (open: boolean) => void;
  setAddOpen: (open: boolean) => void;
  setProjects: (projects: Project[]) => void;
  setProjectCategory: (projectId: string, category: CategoryKey) => void;
  setArchive: (projectId: string, archive: ArchiveState, completeness?: number) => void;
  saveArchive: (projectId: string, key: ArchiveKey, text: string) => void;
  setRuntimeStatus: (status: string) => void;
}

const initialArchives = PROJECTS.reduce<Record<string, ArchiveState>>((acc, project: Project) => {
  acc[project.id] = cloneArchives(project.archive);
  return acc;
}, {});

const emptyArchive = (): ArchiveState => ({
  positioning: { filled: false, text: "" },
  tech: { filled: false, text: "" },
  deploy: { filled: false, text: "" },
  todos: { filled: false, text: "" },
});

export const useMemoirStore = create<MemoirState>((set) => ({
  theme: (localStorage.getItem("memoir-theme") as Theme | null) ?? "dark",
  route: "overview",
  selectedId: null,
  tab: "overview",
  status: "all",
  category: "all",
  focus: null,
  activeTags: [],
  sort: "opened",
  search: "",
  view: "grid",
  loading: true,
  toast: null,
  diff: { open: false, commit: null, mode: "commit", file: null },
  aiOpen: false,
  addOpen: false,
  projects: PROJECTS,
  archives: initialArchives,
  runtimeStatus: "浏览器预览模式",
  setTheme: (theme) => {
    localStorage.setItem("memoir-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
  setRoute: (route) => set({ route }),
  openProject: (id) => set({ selectedId: id, tab: "overview", route: "detail" }),
  goOverview: () => set({ route: "overview" }),
  setTab: (tab) => set({ tab }),
  setStatus: (status) => set({ status, route: "overview" }),
  setCategory: (category) => set({ category, route: "overview" }),
  setFocus: (focus) => set({ focus, route: "overview" }),
  toggleTag: (tag) =>
    set((state) => ({
      route: "overview",
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((item) => item !== tag)
        : [...state.activeTags, tag],
    })),
  clearFilters: () => set({ status: "all", category: "all", focus: null, activeTags: [], search: "" }),
  setSort: (sort) => set({ sort, route: "overview" }),
  setSearch: (search) => set({ search }),
  setView: (view) => set({ view }),
  setLoading: (loading) => set({ loading }),
  showToast: (msg, type = "info") => set({ toast: { msg, type } }),
  clearToast: () => set({ toast: null }),
  openDiff: (commit, mode = "commit", file = null) =>
    set({ diff: { open: true, commit, mode, file } }),
  closeDiff: () => set((state) => ({ diff: { ...state.diff, open: false } })),
  setAiOpen: (open) => set({ aiOpen: open }),
  setAddOpen: (open) => set({ addOpen: open }),
  setProjects: (projects) =>
    set((state) => {
      const archives = { ...state.archives };
      const mergedProjects = projects.map((project) => {
        const previous = state.projects.find((item) => item.id === project.id);
        const archive = archives[project.id] ?? previous?.archive ?? cloneArchives(project.archive);
        archives[project.id] = archive;

        const archiveDescription = archive.positioning.text.trim();
        return {
          ...project,
          archive,
          archiveCompleteness:
            project.archiveCompleteness || previous?.archiveCompleteness || archiveCompleteness(archive),
          description: archiveDescription || project.description || previous?.description || "",
        };
      });

      return { projects: mergedProjects, archives };
    }),
  setProjectCategory: (projectId, category) =>
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === projectId ? { ...project, category } : project,
      ),
    })),
  setArchive: (projectId, archive, completeness) =>
    set((state) => ({
      archives: { ...state.archives, [projectId]: archive },
      projects: state.projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              archive,
              archiveCompleteness: completeness ?? archiveCompleteness(archive),
              description: archive.positioning.text,
            }
          : project,
      ),
    })),
  saveArchive: (projectId, key, text) =>
    set((state) => {
      const project = state.projects.find((item) => item.id === projectId);
      const current = state.archives[projectId] ?? project?.archive ?? emptyArchive();
      const archive = {
        ...current,
        [key]: { filled: text.trim().length > 0, text },
      };

      return {
        archives: {
          ...state.archives,
          [projectId]: archive,
        },
        projects: state.projects.map((item) =>
          item.id === projectId
            ? {
                ...item,
                archive,
                archiveCompleteness: archiveCompleteness(archive),
                description: archive.positioning.text,
              }
            : item,
        ),
      };
    }),
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
}));
