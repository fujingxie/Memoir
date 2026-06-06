import type { CSSProperties, ReactNode } from "react";
import { AppIcon, type IconName } from "./AppIcon";
import { Button } from "./ui/button";
import { LANGS } from "../lib/mock-data";
import { computeCompleteness, ringColor } from "../lib/completeness";
import type { GitInfo, Project, ToastState } from "../lib/types";

interface IconButtonProps {
  name: IconName;
  title: string;
  onClick?: () => void;
  size?: number;
  active?: boolean;
  danger?: boolean;
}

export function IconButton({
  name,
  title,
  onClick,
  size = 30,
  active = false,
  danger = false,
}: IconButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="focus-ring inline-flex cursor-pointer items-center justify-center rounded-[8px] border border-transparent bg-transparent transition hover:bg-[var(--surface-hover)]"
      style={{
        width: size,
        height: size,
        color: active ? "var(--primary)" : danger ? "var(--error)" : "var(--text-secondary)",
        background: active ? "var(--primary-soft)" : undefined,
      }}
    >
      <AppIcon name={name} size={16} />
    </button>
  );
}

export function LangDot({
  lang,
  showLabel = false,
  size = 9,
}: {
  lang: keyof typeof LANGS;
  showLabel?: boolean;
  size?: number;
}) {
  const meta = LANGS[lang];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: meta.color,
          boxShadow: `0 0 0 2px color-mix(in srgb, ${meta.color} 22%, transparent)`,
        }}
      />
      {showLabel ? <span className="text-xs text-[var(--text-secondary)]">{meta.label}</span> : null}
    </span>
  );
}

export function TagChip({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="focus-ring inline-flex h-[22px] items-center rounded-full border px-[9px] text-[11.5px] font-medium transition"
      style={{
        background: active ? "var(--primary-soft)" : "var(--surface-elevated)",
        borderColor: active ? "var(--primary-ring)" : "var(--border)",
        color: active ? "var(--primary)" : "var(--text-secondary)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: Project["status"] }) {
  const archived = status === "archived";
  return (
    <span
      className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold"
      style={{
        background: archived ? "var(--surface-elevated)" : "var(--success-soft)",
        border: archived ? "1px solid var(--border)" : "1px solid transparent",
        color: archived ? "var(--text-tertiary)" : "var(--success)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {archived ? "已归档" : "活跃"}
    </span>
  );
}

function gitMeta(git: GitInfo) {
  if (!git.tracked) {
    return {
      key: "untracked",
      label: "未纳入 Git",
      icon: "gitBranch" as IconName,
      color: "var(--text-tertiary)",
      soft: "var(--surface-elevated)",
    };
  }
  if (git.state === "dirty") {
    return {
      key: "dirty",
      label: `${git.changes} 处改动`,
      icon: "gitCommit" as IconName,
      color: "var(--warning)",
      soft: "var(--warning-soft)",
    };
  }
  if (git.ahead > 0) {
    return {
      key: "ahead",
      label: `领先 ${git.ahead}`,
      icon: "arrowUp" as IconName,
      color: "var(--accent)",
      soft: "var(--accent-soft)",
    };
  }
  if (git.behind > 0) {
    return {
      key: "behind",
      label: `落后 ${git.behind}`,
      icon: "arrowDown" as IconName,
      color: "var(--info)",
      soft: "var(--info-soft)",
    };
  }
  return {
    key: "clean",
    label: "clean",
    icon: "check" as IconName,
    color: "var(--accent)",
    soft: "var(--accent-soft)",
  };
}

export function GitBadge({ git, full = false }: { git: GitInfo; full?: boolean }) {
  const meta = gitMeta(git);
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-semibold"
      style={{
        background: meta.soft,
        color: meta.color,
        border: meta.key === "untracked" ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      <AppIcon name={meta.icon} size={13} />
      <span className={meta.key === "clean" ? "" : "mono"}>{meta.label}</span>
      {full && git.tracked && git.branch ? (
        <span className="mono ml-0.5 font-medium text-[var(--text-tertiary)]">· {git.branch}</span>
      ) : null}
    </span>
  );
}

export function CompletenessRing({
  value,
  size = 44,
  stroke = 4,
  showLabel = true,
}: {
  value: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - value / 100);
  const low = value < 40;

  return (
    <div
      title={`项目档案完整度 ${value}%`}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="block -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor(value)}
          strokeLinecap="round"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={
            {
              "--ring-circ": circ,
              animation: "ringDraw .9s cubic-bezier(.22,.61,.36,1)",
              filter: low
                ? "drop-shadow(0 0 5px color-mix(in srgb, var(--error) 55%, transparent))"
                : "none",
              transition: "stroke-dashoffset .9s cubic-bezier(.22,.61,.36,1)",
            } as CSSProperties
          }
        />
      </svg>
      {showLabel ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ animation: low ? "pulse 1.8s ease-in-out infinite" : "none" }}
        >
          <span
            className="mono font-bold leading-none"
            style={{
              color: low ? "var(--error)" : "var(--text-primary)",
              fontSize: size > 60 ? 18 : size > 48 ? 13 : 11.5,
            }}
          >
            {value}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectCompleteness({
  project,
  archive,
  size = 44,
}: {
  project: Project;
  archive: Project["archive"];
  size?: number;
}) {
  return <CompletenessRing value={computeCompleteness(project, archive)} size={size} />;
}

export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-16 text-center">
      <div className="mb-2 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-tertiary)]">
        <AppIcon name={icon} size={24} strokeWidth={1.4} />
      </div>
      <div className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</div>
      {body ? (
        <div className="max-w-80 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const map: Record<ToastState["type"], { color: string; icon: IconName }> = {
    success: { color: "var(--success)", icon: "checkCircle" },
    warning: { color: "var(--warning)", icon: "alert" },
    error: { color: "var(--error)", icon: "alert" },
    info: { color: "var(--info)", icon: "sparkles" },
  };
  const item = map[toast.type];

  return (
    <div className="toast">
      <AppIcon name={item.icon} size={17} color={item.color} />
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{toast.msg}</span>
    </div>
  );
}

export { Button };
