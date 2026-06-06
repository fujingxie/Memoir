/* ============================================================
   Memoir — Overview page: project cards, grid, states
   ============================================================ */

// ---------- Project card ----------
function ProjectCard({ project, onOpen, onToast, index = 0, view = 'grid', completeness }) {
  const [hover, setHover] = React.useState(false);
  const p = project;
  const comp = completeness != null ? completeness : p.completeness;
  const low = comp < 40;
  const list = view === 'list';

  const quick = (
    <div style={{ display: 'flex', gap: 4, opacity: hover ? 1 : 0, transform: hover ? 'translateX(0)' : 'translateX(4px)', transition: 'opacity .16s, transform .16s', pointerEvents: hover ? 'auto' : 'none' }}>
      <IconButton name="folderOpen" size={28} title="在访达中打开" onClick={(e) => { e.stopPropagation(); onToast(`已在访达中打开 ${p.path}`, 'info'); }} />
      <IconButton name="terminal" size={28} title="用编辑器打开" onClick={(e) => { e.stopPropagation(); onToast(`正在用 VS Code 打开 ${p.name}…`, 'info'); }} />
    </div>
  );

  if (list) {
    return (
      <div
        onClick={() => onOpen(p.id)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
          background: hover ? 'var(--surface-hover)' : 'var(--surface)', borderRadius: 10,
          border: '1px solid var(--border)', cursor: 'pointer', transition: 'background .14s, border-color .14s',
          borderColor: hover ? 'var(--border-strong)' : 'var(--border)',
        }}
      >
        <CompletenessRing value={comp} size={38} stroke={3.5} animate={false} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LangDot lang={p.lang} />
            <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
            {p.pinned && <Icon name="pin" size={12} color="var(--text-tertiary)" />}
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {p.tags.slice(0,2).map(t => <Tag key={t}>{t}</Tag>)}
        </div>
        <GitBadge git={p.git} />
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', width: 78, textAlign: 'right', flexShrink: 0 }}>{p.lastCommit}</span>
        <div style={{ width: 64, display: 'flex', justifyContent: 'flex-end' }}>{hover ? quick : <StatusBadge status={p.status} />}</div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpen(p.id)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', gap: 0,
        background: 'var(--surface)', borderRadius: 12, padding: 16, cursor: 'pointer',
        border: `1px solid ${hover ? 'var(--border-strong)' : 'var(--border)'}`,
        boxShadow: hover ? 'var(--shadow-md)' : 'none',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform .18s cubic-bezier(.22,.61,.36,1), box-shadow .18s, border-color .18s',
        animationDelay: `${index * 38}ms`,
      }}
    >
      {/* low-completeness alert strip */}
      {low && <div style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: 3, background: 'var(--error)' }} />}

      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LangDot lang={p.lang} />
            <span style={{ fontSize: 15.5, fontWeight: 650, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            {p.pinned && <Icon name="pin" size={12} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</div>
        </div>
        <CompletenessRing value={comp} size={46} stroke={4} animate={false} />
      </div>

      {/* description / hint */}
      <div style={{ marginTop: 12, minHeight: 36 }}>
        {p.description
          ? <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
          : <div style={{ fontSize: 12.5, color: low ? 'var(--error)' : 'var(--text-tertiary)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="alert" size={13} /> 还没有档案 — 用 AI 补一份留痕
            </div>}
      </div>

      {/* tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, minHeight: 22 }}>
        {p.tags.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}
      </div>

      {/* divider */}
      <div style={{ height: 1, background: 'var(--border)', margin: '14px -16px 0' }} />

      {/* footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <GitBadge git={p.git} />
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            <Icon name="clock" size={12} /> {p.lastCommit}
          </span>
        </div>
        <div style={{ flexShrink: 0 }}>{hover ? quick : <StatusBadge status={p.status} />}</div>
      </div>
    </div>
  );
}

// ---------- Skeleton card ----------
function SkeletonCard() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '52%', height: 15 }} />
          <div className="skeleton" style={{ width: '70%', height: 11, marginTop: 8 }} />
        </div>
        <div className="skeleton" style={{ width: 46, height: 46, borderRadius: '50%' }} />
      </div>
      <div className="skeleton" style={{ width: '100%', height: 11, marginTop: 16 }} />
      <div className="skeleton" style={{ width: '80%', height: 11, marginTop: 7 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        <div className="skeleton" style={{ width: 46, height: 20, borderRadius: 999 }} />
        <div className="skeleton" style={{ width: 56, height: 20, borderRadius: 999 }} />
      </div>
    </div>
  );
}

// ---------- Overview grid ----------
function Overview({ projects, loading, view, onOpen, onToast, onClearFilters, hasActiveFilters, onAdd, completenessOf }) {
  if (loading) {
    return (
      <div style={gridStyle(view)}>
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (projects.length === 0) {
    if (hasActiveFilters) {
      return <EmptyState icon="search" title="没有匹配的项目" body="试试调整筛选条件或清除搜索关键词。" action={<Button variant="secondary" icon="x" onClick={onClearFilters}>清除筛选</Button>} />;
    }
    return (
      <EmptyState
        icon="folderOpen"
        title="还没有扫描到任何项目"
        body="添加一个扫描根目录(比如 ~/dev),Memoir 会自动发现里面的所有代码项目并建立索引。"
        action={<Button variant="primary" icon="plus" onClick={onAdd}>添加扫描目录</Button>}
      />
    );
  }

  // group by pinned
  const pinned = projects.filter(p => p.pinned);
  const rest = projects.filter(p => !p.pinned);

  return (
    <div>
      {pinned.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <SectionLabel style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Icon name="pin" size={12} /> 已置顶
          </SectionLabel>
          <div className="stagger" style={gridStyle(view)}>
            {pinned.map((p, i) => <ProjectCard key={p.id} project={p} index={i} view={view} onOpen={onOpen} onToast={onToast} completeness={completenessOf && completenessOf(p)} />)}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <SectionLabel style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Icon name="dotGrid" size={12} /> 全部项目 <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>· {rest.length}</span>
            </SectionLabel>
          )}
          <div className="stagger" style={gridStyle(view)}>
            {rest.map((p, i) => <ProjectCard key={p.id} project={p} index={i + pinned.length} view={view} onOpen={onOpen} onToast={onToast} completeness={completenessOf && completenessOf(p)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function gridStyle(view) {
  if (view === 'list') return { display: 'flex', flexDirection: 'column', gap: 8 };
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 };
}

Object.assign(window, { ProjectCard, SkeletonCard, Overview, gridStyle });
