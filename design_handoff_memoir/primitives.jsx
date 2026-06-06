/* ============================================================
   Memoir — UI primitives
   ============================================================ */

// ---------- Button ----------
function Button({ variant = 'secondary', size = 'md', icon, iconRight, children, onClick, disabled, loading, style = {}, title }) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const h = size === 'sm' ? 28 : 34;
  const pad = size === 'sm' ? '0 10px' : '0 14px';
  const fs = size === 'sm' ? 12.5 : 13.5;

  const variants = {
    primary: {
      bg: down ? 'var(--primary-active)' : hover ? 'var(--primary-hover)' : 'var(--primary)',
      color: '#fff', border: 'transparent',
    },
    secondary: {
      bg: hover ? 'var(--surface-hover)' : 'var(--surface-elevated)',
      color: 'var(--text-primary)', border: 'var(--border)',
    },
    ghost: {
      bg: hover ? 'var(--surface-hover)' : 'transparent',
      color: 'var(--text-secondary)', border: 'transparent',
    },
    danger: {
      bg: hover ? 'var(--error)' : 'var(--error-soft)',
      color: hover ? '#fff' : 'var(--error)', border: 'transparent',
    },
  };
  const v = variants[variant];
  return (
    <button
      title={title}
      onClick={disabled || loading ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setDown(false); }}
      onMouseDown={() => setDown(true)} onMouseUp={() => setDown(false)}
      className="focus-ring"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        height: h, padding: pad, fontSize: fs, fontWeight: 550, lineHeight: 1,
        fontFamily: 'inherit', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        background: v.bg, color: v.color, border: `1px solid ${v.border}`,
        borderRadius: 8, opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap',
        transition: 'background .14s, color .14s, transform .08s, box-shadow .14s',
        transform: down && !disabled ? 'scale(.97)' : 'scale(1)',
        boxShadow: variant === 'primary' && !disabled ? '0 1px 2px rgba(0,0,0,.3)' : 'none',
        ...style,
      }}
    >
      {loading
        ? <Icon name="refresh" size={size === 'sm' ? 13 : 15} style={{ animation: 'spin 1s linear infinite' }} />
        : icon && <Icon name={icon} size={size === 'sm' ? 13 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 13 : 15} />}
    </button>
  );
}

// ---------- Icon button ----------
function IconButton({ name, onClick, title, size = 30, active = false, danger = false }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="focus-ring"
      style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--primary-soft)' : hover ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--primary)' : danger && hover ? 'var(--error)' : hover ? 'var(--text-primary)' : 'var(--text-secondary)',
        border: '1px solid transparent', borderRadius: 8, cursor: 'pointer',
        transition: 'background .14s, color .14s',
      }}
    >
      <Icon name={name} size={16} />
    </button>
  );
}

// ---------- Language dot ----------
function LangDot({ lang, showLabel = false, size = 9 }) {
  const l = LANGS[lang] || { label: lang, color: '#888' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: l.color, flexShrink: 0, boxShadow: `0 0 0 2px color-mix(in srgb, ${l.color} 22%, transparent)` }} />
      {showLabel && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.label}</span>}
    </span>
  );
}

// ---------- Tag ----------
function Tag({ children, onClick, active = false }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
        fontSize: 11.5, fontWeight: 500, borderRadius: 999, cursor: onClick ? 'pointer' : 'default',
        background: active ? 'var(--primary-soft)' : hover && onClick ? 'var(--surface-hover)' : 'var(--surface-elevated)',
        color: active ? 'var(--primary)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--primary-ring)' : 'var(--border)'}`,
        transition: 'all .14s', whiteSpace: 'nowrap',
      }}
    >{children}</span>
  );
}

// ---------- Status badge (active / archived) ----------
function StatusBadge({ status }) {
  const archived = status === 'archived';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 20, padding: '0 8px 0 7px',
      fontSize: 11, fontWeight: 550, borderRadius: 999,
      background: archived ? 'var(--surface-elevated)' : 'var(--success-soft)',
      color: archived ? 'var(--text-tertiary)' : 'var(--success)',
      border: `1px solid ${archived ? 'var(--border)' : 'transparent'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {archived ? '已归档' : '活跃'}
    </span>
  );
}

// ---------- Git badge ----------
function gitMeta(git) {
  if (!git.tracked) return { key: 'untracked', label: '未纳入 Git', icon: 'gitBranch', color: 'var(--text-tertiary)', soft: 'var(--surface-elevated)' };
  if (git.state === 'dirty') return { key: 'dirty', label: `${git.changes} 处改动`, icon: 'gitCommit', color: 'var(--warning)', soft: 'var(--warning-soft)' };
  if (git.ahead > 0) return { key: 'ahead', label: `领先 ${git.ahead}`, icon: 'arrowUp', color: 'var(--accent)', soft: 'var(--accent-soft)' };
  if (git.behind > 0) return { key: 'behind', label: `落后 ${git.behind}`, icon: 'arrowDown', color: 'var(--info)', soft: 'var(--info-soft)' };
  return { key: 'clean', label: 'clean', icon: 'check', color: 'var(--accent)', soft: 'var(--accent-soft)' };
}

function GitBadge({ git, full = false }) {
  const m = gitMeta(git);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 9px 0 7px',
      fontSize: 11.5, fontWeight: 550, borderRadius: 6,
      background: m.soft, color: m.color, whiteSpace: 'nowrap', flexShrink: 0,
      border: m.key === 'untracked' ? '1px solid var(--border)' : '1px solid transparent',
    }}>
      <Icon name={m.icon} size={13} strokeWidth={1.7} />
      <span className={m.key === 'clean' ? '' : 'mono'} style={{ letterSpacing: m.key === 'clean' ? 0 : .2 }}>{m.label}</span>
      {full && git.tracked && git.branch && (
        <span className="mono" style={{ color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 2 }}>· {git.branch}</span>
      )}
    </span>
  );
}

// ---------- Completeness ring ----------
function ringColor(v) {
  if (v < 40) return 'var(--error)';
  if (v < 70) return 'var(--warning)';
  return 'var(--success)';
}

// Unified completeness — driven by how much of the project's archive is filled,
// plus light bonuses for git / description / docs. Used on cards AND detail so
// the number is consistent and reacts when the user fills in the archive.
function computeCompleteness(project, archiveState) {
  const a = archiveState || project.archive || {};
  const filled = ['positioning','tech','deploy','todos'].filter(k => a[k]?.filled).length;
  let score = filled * 20
    + (project.git?.tracked ? 8 : 0)
    + (project.description ? 6 : 0)
    + ((project.docs?.length || 0) > 0 ? 4 : 0)
    + ((project.commits?.length || 0) > 0 ? 2 : 0);
  return Math.max(0, Math.min(100, score));
}
function CompletenessRing({ value, size = 44, stroke = 4, showLabel = true, animate = true }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const color = ringColor(value);
  const low = value < 40;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      title={`项目档案完整度 ${value}%`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{
            '--ring-circ': circ,
            transition: 'stroke-dashoffset .9s cubic-bezier(.22,.61,.36,1)',
            animation: animate ? 'ringDraw .9s cubic-bezier(.22,.61,.36,1)' : 'none',
            filter: low ? `drop-shadow(0 0 5px color-mix(in srgb, ${'var(--error)'} 55%, transparent))` : 'none',
          }}
        />
      </svg>
      {showLabel && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', animation: low ? 'pulse 1.8s ease-in-out infinite' : 'none',
        }}>
          <span style={{ fontSize: size > 60 ? 18 : size > 48 ? 13 : 11.5, fontWeight: 650, color: low ? 'var(--error)' : 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{value}</span>
          {size > 60 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>完整度</span>}
        </div>
      )}
    </div>
  );
}

// ---------- Empty state ----------
function EmptyState({ icon = 'inbox', title, body, action, compact = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: compact ? '40px 24px' : '72px 24px', gap: 4, animation: 'riseIn .4s',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface-elevated)', border: '1px solid var(--border)', marginBottom: 10,
        color: 'var(--text-tertiary)',
      }}>
        <Icon name={icon} size={24} strokeWidth={1.4} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 320, lineHeight: 1.55 }}>{body}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

// ---------- Section label ----------
function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase',
      color: 'var(--text-tertiary)', ...style,
    }}>{children}</div>
  );
}

// ---------- Toast ----------
function Toast({ toast }) {
  if (!toast) return null;
  const map = {
    success: { color: 'var(--success)', icon: 'checkCircle' },
    warning: { color: 'var(--warning)', icon: 'alert' },
    error:   { color: 'var(--error)',   icon: 'alert' },
    info:    { color: 'var(--info)',    icon: 'sparkles' },
  };
  const t = map[toast.type] || map.info;
  return (
    <div style={{
      position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px 11px 13px',
      background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)',
      borderRadius: 10, boxShadow: 'var(--shadow-lg)', animation: 'slideUp .3s cubic-bezier(.22,.61,.36,1)',
      maxWidth: 420,
    }}>
      <Icon name={t.icon} size={17} color={t.color} />
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{toast.msg}</span>
    </div>
  );
}

Object.assign(window, {
  Button, IconButton, LangDot, Tag, StatusBadge, GitBadge, gitMeta,
  CompletenessRing, ringColor, computeCompleteness, EmptyState, SectionLabel, Toast,
});
