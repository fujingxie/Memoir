import { AppIcon } from "../components/AppIcon";
import { Button, IconButton } from "../components/Primitives";
import { EDITOR_PRESETS, PROJECT_CATEGORIES, editorLabel } from "../lib/categories";
import { SCAN_ROOTS } from "../lib/mock-data";
import {
  addPersistedScanRoot,
  getAppSettings,
  getDeepSeekKeyStatus,
  getGitHubTokenStatus,
  removePersistedScanRoot,
  saveDeepSeekApiKey,
  saveGitHubToken,
  setPersistedCategoryEditor,
  setPersistedEditorCommand,
  setPersistedThemeSetting,
} from "../lib/projects-api";
import type { AppSettings } from "../lib/projects-api";
import type { CategoryKey, EditorKey, Theme } from "../lib/types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

interface SecretStatus {
  configured: boolean;
  masked: string | null;
}

interface SettingsProps {
  theme: Theme;
  runtimeStatus: string;
  onTheme: (theme: Theme) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onAdd: () => void;
}

export function Settings({ theme, runtimeStatus, onTheme, onToast, onAdd }: SettingsProps) {
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<SecretStatus>({
    configured: false,
    masked: null,
  });
  const [githubTokenDraft, setGithubTokenDraft] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [savingGithubToken, setSavingGithubToken] = useState(false);
  const [githubTokenStatus, setGithubTokenStatus] = useState<SecretStatus>({
    configured: false,
    masked: null,
  });
  const [scanRoots, setScanRoots] = useState<string[]>(SCAN_ROOTS);
  const [rootDraft, setRootDraft] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [editorCmd, setEditorCmd] = useState("code");
  const [categoryEditors, setCategoryEditors] = useState<AppSettings["category_editors"]>({});

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setSettingsLoading(true);
      try {
        const [status, githubStatus, settings] = await Promise.all([
          getDeepSeekKeyStatus(),
          getGitHubTokenStatus(),
          getAppSettings(),
        ]);
        if (cancelled) return;
        if (status) setKeyStatus(status);
        if (githubStatus) setGithubTokenStatus(githubStatus);
        if (settings) {
          setScanRoots(settings.scan_roots);
          setEditorCmd(settings.editor_cmd);
          setCategoryEditors(settings.category_editors ?? {});
          if (settings.theme !== theme) onTheme(settings.theme);
        }
      } catch (error) {
        console.log("[DEBUG][Settings.loadSettings]", { error }, new Date().toISOString());
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveKey = async () => {
    setSavingKey(true);
    try {
      const status = await saveDeepSeekApiKey(keyDraft);
      if (!status) {
        onToast("浏览器预览模式不会保存 DeepSeek Key", "info");
        return;
      }
      setKeyStatus(status);
      setKeyDraft("");
      onToast(status.configured ? "DeepSeek Key 已保存" : "DeepSeek Key 已清空", "success");
    } catch (error) {
      console.log("[DEBUG][Settings.saveKey]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "DeepSeek Key 保存失败", "error");
    } finally {
      setSavingKey(false);
    }
  };

  const saveGithubToken = async () => {
    setSavingGithubToken(true);
    try {
      const status = await saveGitHubToken(githubTokenDraft);
      if (!status) {
        const simulated = previewSecretStatus(githubTokenDraft);
        setGithubTokenStatus(simulated);
        setGithubTokenDraft("");
        onToast(
          simulated.configured
            ? "浏览器预览模式: 已模拟保存 GitHub Token"
            : "浏览器预览模式: 已模拟清空 GitHub Token",
          "info",
        );
        return;
      }
      setGithubTokenStatus(status);
      setGithubTokenDraft("");
      onToast(status.configured ? "GitHub Token 已保存" : "GitHub Token 已清空", "success");
    } catch (error) {
      console.log("[DEBUG][Settings.saveGithubToken]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "GitHub Token 保存失败", "error");
    } finally {
      setSavingGithubToken(false);
    }
  };

  const applySettings = (settings: AppSettings | null, message: string) => {
    if (!settings) {
      onToast(`浏览器预览模式: ${message}`, "info");
      return;
    }
    setScanRoots(settings.scan_roots);
    setEditorCmd(settings.editor_cmd);
    setCategoryEditors(settings.category_editors ?? {});
    onToast(message, "success");
  };

  const addRoot = async () => {
    const root = rootDraft.trim();
    if (!root) {
      onToast("请输入扫描目录", "warning");
      return;
    }

    try {
      const settings = await addPersistedScanRoot(root);
      if (!settings) {
        setScanRoots((items) => (items.includes(root) ? items : [...items, root]));
        setRootDraft("");
        onToast("浏览器预览模式: 已模拟添加扫描目录", "info");
        return;
      }
      applySettings(settings, "扫描目录已添加");
      setRootDraft("");
    } catch (error) {
      console.log("[DEBUG][Settings.addRoot]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "添加扫描目录失败", "error");
    }
  };

  const removeRoot = async (root: string) => {
    try {
      const settings = await removePersistedScanRoot(root);
      if (!settings) {
        setScanRoots((items) => items.filter((item) => item !== root));
        onToast("浏览器预览模式: 已模拟移除扫描目录", "info");
        return;
      }
      applySettings(settings, "扫描目录已移除");
    } catch (error) {
      console.log("[DEBUG][Settings.removeRoot]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "移除扫描目录失败", "error");
    }
  };

  const selectEditor = async (cmd: string) => {
    try {
      const settings = await setPersistedEditorCommand(cmd);
      if (!settings) {
        setEditorCmd(cmd);
        onToast(`浏览器预览模式: 默认编辑器设为 ${editorLabel(cmd)}`, "info");
        return;
      }
      applySettings(settings, `默认编辑器已设为 ${editorLabel(settings.editor_cmd)}`);
    } catch (error) {
      console.log("[DEBUG][Settings.selectEditor]", { error }, new Date().toISOString());
      onToast(error instanceof Error ? error.message : "保存默认编辑器失败", "error");
    }
  };

  const selectCategoryEditor = async (category: CategoryKey, editorKey: EditorKey | "") => {
    const previous = categoryEditors;
    setCategoryEditors((items) => {
      const next = { ...items };
      if (editorKey) next[category] = editorKey;
      else delete next[category];
      return next;
    });

    try {
      const settings = await setPersistedCategoryEditor(category, editorKey);
      if (!settings) {
        onToast("浏览器预览模式: 已模拟保存分类编辑器", "info");
        return;
      }
      applySettings(settings, "分类编辑器已保存");
    } catch (error) {
      console.log("[DEBUG][Settings.selectCategoryEditor]", { category, editorKey, error }, new Date().toISOString());
      setCategoryEditors(previous);
      onToast(error instanceof Error ? error.message : "保存分类编辑器失败", "error");
    }
  };

  const selectTheme = async (nextTheme: Theme) => {
    onTheme(nextTheme);
    try {
      await setPersistedThemeSetting(nextTheme);
    } catch (error) {
      console.log("[DEBUG][Settings.selectTheme]", { error }, new Date().toISOString());
    }
  };

  return (
    <div className="mx-auto max-w-[720px] px-7 py-8">
      <header className="mb-8">
        <h1 className="text-[23px] font-bold">设置</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">所有配置仅保存在本机。</p>
      </header>

      <SettingGroup icon="folder" title="扫描根目录" subtitle="Memoir 会在这些目录下发现并索引代码项目">
        <div className="space-y-2">
          {settingsLoading ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-[13px] text-[var(--text-tertiary)]">
              正在读取扫描目录...
            </div>
          ) : null}
          {!settingsLoading && scanRoots.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-[13px] text-[var(--text-tertiary)]">
              还没有扫描根目录。
            </div>
          ) : null}
          {scanRoots.map((root) => (
            <div
              key={root}
              className="panel-row rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
            >
              <span className="mono flex items-center gap-2 text-[13px]">
                <AppIcon name="folder" size={15} color="var(--accent)" />
                {root}
              </span>
              <IconButton name="x" title="移除目录" onClick={() => void removeRoot(root)} />
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={rootDraft}
              onChange={(event) => setRootDraft(event.target.value)}
              placeholder="/Users/me/dev"
              className="focus-ring mono h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] outline-none"
            />
            <Button variant="secondary" onClick={addRoot}>
              <AppIcon name="plus" size={15} />
              添加目录
            </Button>
            <Button variant="ghost" onClick={onAdd}>
              扫描导入
            </Button>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup icon="sparkles" title="DeepSeek API Key" subtitle="用于 AI 自动生成项目档案,密钥存于本机设置">
        <div className="space-y-2">
          <div className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <AppIcon name="link" size={15} color="var(--text-tertiary)" />
            <input
              className="mono min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
              value={keyDraft}
              type={showKey ? "text" : "password"}
              placeholder={keyStatus.configured ? `已保存 ${keyStatus.masked ?? ""}` : "粘贴 sk-..."}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
            <button
              className="text-xs text-[var(--text-tertiary)]"
              onClick={() => setShowKey((value) => !value)}
              type="button"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
            <Button size="sm" disabled={savingKey} onClick={saveKey}>
              <AppIcon name="check" size={13} />
              {savingKey ? "保存中" : "保存"}
            </Button>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {keyStatus.configured
              ? `当前已配置 ${keyStatus.masked ?? ""}; 留空保存可清空。`
              : "尚未配置; 未配置时 AI 生成会给出明确提示。"}
          </div>
        </div>
      </SettingGroup>

      <SettingGroup icon="globe" title="GitHub Token" subtitle="用于创建仓库并首次上传,密钥存于系统钥匙串">
        <div className="space-y-2">
          <div className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <AppIcon name="gitBranch" size={15} color="var(--text-tertiary)" />
            <input
              className="mono min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
              value={githubTokenDraft}
              type={showGithubToken ? "text" : "password"}
              placeholder={
                githubTokenStatus.configured
                  ? `已保存 ${githubTokenStatus.masked ?? ""}`
                  : "粘贴 github_pat_..."
              }
              onChange={(event) => setGithubTokenDraft(event.target.value)}
            />
            <button
              className="text-xs text-[var(--text-tertiary)]"
              onClick={() => setShowGithubToken((value) => !value)}
              type="button"
            >
              {showGithubToken ? "隐藏" : "显示"}
            </button>
            <Button size="sm" disabled={savingGithubToken} onClick={saveGithubToken}>
              <AppIcon name="check" size={13} />
              {savingGithubToken ? "保存中" : "保存"}
            </Button>
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {githubTokenStatus.configured
              ? `当前已配置 ${githubTokenStatus.masked ?? ""}; 留空保存可清空。`
              : "尚未配置; 发布到 GitHub 时可临时输入 Token。"}
          </div>
        </div>
      </SettingGroup>

      <SettingGroup icon="terminal" title="默认编辑器" subtitle="点击「编辑器打开」时使用">
        <div className="flex flex-wrap gap-2">
          {EDITOR_PRESETS.map((editor) => (
            <Button
              key={editor.key}
              variant={editorCmd === editor.key ? "primary" : "secondary"}
              onClick={() => void selectEditor(editor.key)}
            >
              {editor.label}
            </Button>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup icon="tag" title="分类编辑器" subtitle="分类未设置时继承默认编辑器">
        <div className="space-y-2">
          {PROJECT_CATEGORIES.map((category) => (
            <div
              key={category.id}
              className="panel-row rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <span className="text-[13px] font-semibold text-[var(--text-secondary)]">{category.label}</span>
              <select
                className="settings-select"
                value={categoryEditors[category.id] ?? ""}
                onChange={(event) =>
                  void selectCategoryEditor(category.id, event.target.value as EditorKey | "")
                }
              >
                <option value="">继承默认 ({editorLabel(editorCmd)})</option>
                {EDITOR_PRESETS.map((editor) => (
                  <option key={editor.key} value={editor.key}>
                    {editor.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup icon="layers" title="主题" subtitle="深色 / 浅色外观">
        <div className="grid grid-cols-2 gap-3">
          <ThemeCard active={theme === "dark"} label="深色" mode="dark" onClick={() => void selectTheme("dark")} />
          <ThemeCard active={theme === "light"} label="浅色" mode="light" onClick={() => void selectTheme("light")} />
        </div>
      </SettingGroup>

      <SettingGroup icon="bookOpen" title="关于" subtitle="Memoir MVP">
        <div className="panel pad">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Memoir 0.1.0</div>
              <div className="mt-1 text-xs text-[var(--text-tertiary)]">本机项目记忆库 · Tauri 2</div>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1 text-xs text-[var(--text-secondary)]">
              {runtimeStatus}
            </span>
          </div>
        </div>
      </SettingGroup>
    </div>
  );
}

function previewSecretStatus(secret: string): SecretStatus {
  const trimmed = secret.trim();
  return {
    configured: trimmed.length > 0,
    masked: maskSecret(trimmed),
  };
}

function maskSecret(secret: string): string | null {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  if ([...trimmed].length <= 12) return "••••";
  return `${trimmed.slice(0, 8)}••••${trimmed.slice(-4)}`;
}

function SettingGroup({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: Parameters<typeof AppIcon>[0]["name"];
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-8 border-b border-[var(--border)] pb-7 last:border-b-0">
      <div className="mb-4 flex items-start gap-3">
        <AppIcon name={icon} size={16} color="var(--text-secondary)" />
        <div>
          <h2 className="text-[15px] font-bold">{title}</h2>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">{subtitle}</p>
        </div>
      </div>
      <div className="pl-7">{children}</div>
    </section>
  );
}

function ThemeCard({
  label,
  mode,
  active,
  onClick,
}: {
  label: string;
  mode: Theme;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="focus-ring rounded-[10px] border p-3 text-left transition hover:bg-[var(--surface-hover)]"
      style={{
        borderColor: active ? "var(--primary-ring)" : "var(--border)",
        background: active ? "var(--primary-soft)" : "var(--surface)",
      }}
      onClick={onClick}
    >
      <div
        className="mb-3 h-[74px] overflow-hidden rounded-lg border"
        style={{
          borderColor:
            mode === "dark" ? "var(--preview-dark-border-strong)" : "var(--preview-light-border-strong)",
          background: mode === "dark" ? "var(--preview-dark-bg)" : "var(--preview-light-bg)",
        }}
      >
        <div
          className="h-5 border-b"
          style={{
            borderColor: mode === "dark" ? "var(--preview-dark-border)" : "var(--preview-light-border)",
            background: mode === "dark" ? "var(--preview-dark-surface)" : "var(--preview-light-surface)",
          }}
        />
        <div className="grid grid-cols-[44px_1fr] gap-2 p-2">
          <div
            className="h-10 rounded"
            style={{
              background:
                mode === "dark" ? "var(--preview-dark-elevated)" : "var(--preview-light-surface)",
            }}
          />
          <div className="space-y-2">
            <div
              className="h-2 w-24 rounded-full"
              style={{
                background: mode === "dark" ? "var(--preview-dark-primary)" : "var(--preview-light-primary)",
              }}
            />
            <div
              className="h-2 w-32 rounded-full"
              style={{
                background:
                  mode === "dark"
                    ? "var(--preview-dark-border-strong)"
                    : "var(--preview-light-border-strong)",
              }}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{label}</span>
        {active ? <AppIcon name="check" size={15} color="var(--primary)" /> : null}
      </div>
    </button>
  );
}
