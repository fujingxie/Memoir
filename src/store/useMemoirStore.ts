import { create } from "zustand";
import { cloneArchives } from "../lib/utils";
import { PROJECTS } from "../lib/mock-data";
import type {
  ArchiveKey,
  ArchiveState,
  DetailTab,
  DiffState,
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
  activeTags: string[];
  sort: SortKey;
  search: string;
  view: ViewMode;
  loading: boolean;
  toast: ToastState | null;
  diff: DiffState;
  aiOpen: boolean;
  addOpen: boolean;
  archives: Record<string, ArchiveState>;
  runtimeStatus: string;
  setTheme: (theme: Theme) => void;
  setRoute: (route: Route) => void;
  openProject: (id: string) => void;
  goOverview: () => void;
  setTab: (tab: DetailTab) => void;
  setStatus: (status: ProjectStatus | "all") => void;
  toggleTag: (tag: string) => void;
  clearFilters: () => void;
  setSort: (sort: SortKey) => void;
  setSearch: (search: string) => void;
  setView: (view: ViewMode) => void;
  setLoading: (loading: boolean) => void;
  showToast: (msg: string, type?: ToastState["type"]) => void;
  clearToast: () => void;
  openDiff: (commit: DiffState["commit"], mode?: DiffState["mode"]) => void;
  closeDiff: () => void;
  setAiOpen: (open: boolean) => void;
  setAddOpen: (open: boolean) => void;
  saveArchive: (projectId: string, key: ArchiveKey, text: string) => void;
  setRuntimeStatus: (status: string) => void;
}

const initialArchives = PROJECTS.reduce<Record<string, ArchiveState>>((acc, project: Project) => {
  acc[project.id] = cloneArchives(project.archive);
  return acc;
}, {});

export const useMemoirStore = create<MemoirState>((set) => ({
  theme: (localStorage.getItem("memoir-theme") as Theme | null) ?? "dark",
  route: "overview",
  selectedId: null,
  tab: "overview",
  status: "all",
  activeTags: [],
  sort: "opened",
  search: "",
  view: "grid",
  loading: true,
  toast: null,
  diff: { open: false, commit: null, mode: "commit" },
  aiOpen: false,
  addOpen: false,
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
  toggleTag: (tag) =>
    set((state) => ({
      route: "overview",
      activeTags: state.activeTags.includes(tag)
        ? state.activeTags.filter((item) => item !== tag)
        : [...state.activeTags, tag],
    })),
  clearFilters: () => set({ status: "all", activeTags: [], search: "" }),
  setSort: (sort) => set({ sort, route: "overview" }),
  setSearch: (search) => set({ search }),
  setView: (view) => set({ view }),
  setLoading: (loading) => set({ loading }),
  showToast: (msg, type = "info") => set({ toast: { msg, type } }),
  clearToast: () => set({ toast: null }),
  openDiff: (commit, mode = "commit") => set({ diff: { open: true, commit, mode } }),
  closeDiff: () => set((state) => ({ diff: { ...state.diff, open: false } })),
  setAiOpen: (open) => set({ aiOpen: open }),
  setAddOpen: (open) => set({ addOpen: open }),
  saveArchive: (projectId, key, text) =>
    set((state) => ({
      archives: {
        ...state.archives,
        [projectId]: {
          ...state.archives[projectId],
          [key]: { filled: text.trim().length > 0, text },
        },
      },
    })),
  setRuntimeStatus: (runtimeStatus) => set({ runtimeStatus }),
}));
