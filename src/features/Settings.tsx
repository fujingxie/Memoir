import { AppIcon } from "../components/AppIcon";
import { Button, IconButton } from "../components/Primitives";
import { SCAN_ROOTS } from "../lib/mock-data";
import type { Theme } from "../lib/types";
import type { ReactNode } from "react";

interface SettingsProps {
  theme: Theme;
  runtimeStatus: string;
  onTheme: (theme: Theme) => void;
  onToast: (message: string, type?: "success" | "warning" | "error" | "info") => void;
  onAdd: () => void;
}

export function Settings({ theme, runtimeStatus, onTheme, onToast, onAdd }: SettingsProps) {
  return (
    <div className="mx-auto max-w-[720px] px-7 py-8">
      <header className="mb-8">
        <h1 className="text-[23px] font-bold">设置</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">所有配置仅保存在本机。</p>
      </header>

      <SettingGroup icon="folder" title="扫描根目录" subtitle="Memoir 会在这些目录下发现并索引代码项目">
        <div className="space-y-2">
          {SCAN_ROOTS.map((root) => (
            <div
              key={root}
              className="panel-row rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-3"
            >
              <span className="mono flex items-center gap-2 text-[13px]">
                <AppIcon name="folder" size={15} color="var(--accent)" />
                {root}
              </span>
              <IconButton name="x" title="移除目录" />
            </div>
          ))}
          <Button variant="secondary" onClick={onAdd}>
            <AppIcon name="plus" size={15} />
            添加目录
          </Button>
        </div>
      </SettingGroup>

      <SettingGroup icon="sparkles" title="DeepSeek API Key" subtitle="用于 AI 自动生成项目档案,密钥存于本机设置">
        <div className="flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3">
          <AppIcon name="link" size={15} color="var(--text-tertiary)" />
          <input
            className="mono min-w-0 flex-1 border-0 bg-transparent text-[13px] text-[var(--text-primary)] outline-none"
            defaultValue="sk-deepseek-••••••••••••••3f9a"
          />
          <button className="text-xs text-[var(--text-tertiary)]">显示</button>
          <Button size="sm" onClick={() => onToast("Key 验证命令将在 T8 接入", "info")}>
            <AppIcon name="check" size={13} />
            验证
          </Button>
        </div>
      </SettingGroup>

      <SettingGroup icon="terminal" title="默认编辑器" subtitle="点击「编辑器打开」时使用">
        <div className="flex flex-wrap gap-2">
          {["VS Code", "Cursor", "WebStorm", "Zed"].map((editor) => (
            <Button
              key={editor}
              variant={editor === "VS Code" ? "primary" : "secondary"}
              onClick={() => onToast(`默认编辑器将在 T10 持久化: ${editor}`, "info")}
            >
              {editor}
            </Button>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup icon="layers" title="主题" subtitle="深色 / 浅色外观">
        <div className="grid grid-cols-2 gap-3">
          <ThemeCard active={theme === "dark"} label="深色" mode="dark" onClick={() => onTheme("dark")} />
          <ThemeCard active={theme === "light"} label="浅色" mode="light" onClick={() => onTheme("light")} />
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
