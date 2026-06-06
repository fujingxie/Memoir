/* ============================================================
   Memoir — App shell: window chrome, sidebar, routing, state
   ============================================================ */

const OPENED_RANK = ['dotfiles','memoir','next-blog','rust-cli','design-tokens','ml-experiments','api-gateway','scraper-bot','portfolio-2021','game-jam-2020'];
const COMMIT_RANK = ['memoir','rust-cli','dotfiles','next-blog','design-tokens','api-gateway','scraper-bot','ml-experiments','portfolio-2021','game-jam-2020'];

const SORTS = [
  { id: 'opened', label: '最近打开', icon: 'clock' },
  { id: 'commit', label: '最近提交', icon: 'gitCommit' },
  { id: 'completeness', label: '完整度', icon: 'layers' },
  { id: 'name', label: '名称', icon: 'sort' },
];

function App() {
  // theme
  const [theme, setTheme] = React.useState(() => localStorage.getItem('memoir-theme') || 'dark');
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('memoir-theme', theme); }, [theme]);

  // routing
  const [route, setRoute] = React.useState('overview'); // overview | detail | settings
  const [selectedId, setSelectedId] = React.useState(null);
  const [tab, setTab] = React.useState('overview');

  // filters
  const [status, setStatus] = React.useState('all');
  const [activeTags, setActiveTags] = React.useState([]);
  const [sort, setSort] = React.useState('opened');
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState('grid');

  // loading skeleton on first mount
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { const t = setTimeout(() => setLoading(false), 900); return () => clearTimeout(t); }, []);

  // toast
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef();
  const showToast = (msg, type = 'info') => { setToast({ msg, type }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); };

  // drawers / modals
  const [diff, setDiff] = React.useState({ open: false, commit: null, mode: 'commit' });
  const [aiOpen, setAiOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);

  // archive state per project (editable / AI-adoptable)
  const [archives, setArchives] = React.useState(() => {
    const o = {};
    PROJECTS.forEach(p => { o[p.id] = JSON.parse(JSON.stringify(p.archive)); });
    return o;
  });
  const saveArchive = (pid, key, text) => setArchives(a => ({ ...a, [pid]: { ...a[pid], [key]: { filled: text.trim().length > 0, text } } }));
  const completenessOf = React.useCallback((p) => computeCompleteness(p, archives[p.id]), [archives]);

  const allTags = React.useMemo(() => [...new Set(PROJECTS.flatMap(p => p.tags))], []);

  // derived list
  const filtered = React.useMemo(() => {
    let list = PROJECTS.filter(p => {
      if (status !== 'all' && p.status !== status) return false;
      if (activeTags.length && !activeTags.some(t => p.tags.includes(t))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || (p.description||'').toLowerCase().includes(q))) return false;
      }
      return true;
    });
    const by = {
      opened: (a, b) => OPENED_RANK.indexOf(a.id) - OPENED_RANK.indexOf(b.id),
      commit: (a, b) => COMMIT_RANK.indexOf(a.id) - COMMIT_RANK.indexOf(b.id),
      completeness: (a, b) => completenessOf(b) - completenessOf(a),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [status, activeTags, sort, search, completenessOf]);

  const selected = PROJECTS.find(p => p.id === selectedId);
  const hasFilters = status !== 'all' || activeTags.length > 0 || search.trim().length > 0;

  const openProject = (id) => { setSelectedId(id); setTab('overview'); setRoute('detail'); };
  const goOverview = () => setRoute('overview');

  const toggleTag = (t) => setActiveTags(ts => ts.includes(t) ? ts.filter(x => x !== t) : [...ts, t]);

  return (
    <div style={{ width: 'min(1440px, calc(100vw - 56px))', height: 'min(920px, calc(100vh - 56px))', display: 'flex', borderRadius: 14, overflow: 'hidden', position: 'relative', background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: '0 0 0 1px rgba(0,0,0,.25), 0 30px 80px rgba(0,0,0,.5)' }}>

      {/* ============ SIDEBAR ============ */}
      <aside style={{ width: 244, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* traffic lights / titlebar */}
        <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
          <TrafficLights />
        </div>

        {/* wordmark */}
        <div style={{ padding: '4px 16px 14px', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="bookOpen" size={15} color="#fff" />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-.01em' }}>Memoir</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
          <NavItem icon="dotGrid" label="项目库" count={PROJECTS.length} active={route !== 'settings'} onClick={goOverview} />

          {/* filters only meaningful in library */}
          <div style={{ marginTop: 22 }}>
            <SidebarLabel>状态</SidebarLabel>
            <div style={{ display: 'flex', gap: 4, padding: '0 6px' }}>
              {[{ id: 'all', label: '全部' }, { id: 'active', label: '活跃' }, { id: 'archived', label: '归档' }].map(s => (
                <button key={s.id} onClick={() => { setStatus(s.id); goOverview(); }}
                  style={{ flex: 1, height: 28, borderRadius: 7, fontSize: 12, fontWeight: 550, cursor: 'pointer', fontFamily: 'inherit',
                    background: status === s.id ? 'var(--primary-soft)' : 'transparent', color: status === s.id ? 'var(--primary)' : 'var(--text-secondary)',
                    border: `1px solid ${status === s.id ? 'var(--primary-ring)' : 'var(--border)'}`, transition: 'all .14s' }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <SidebarLabel>排序</SidebarLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {SORTS.map(s => (
                <button key={s.id} onClick={() => { setSort(s.id); goOverview(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, height: 30, padding: '0 8px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                    background: sort === s.id ? 'var(--surface-hover)' : 'transparent', color: sort === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12.5, fontWeight: sort === s.id ? 550 : 450, transition: 'all .12s' }}>
                  <Icon name={s.icon} size={14} color={sort === s.id ? 'var(--primary)' : 'var(--text-tertiary)'} />
                  {s.label}
                  {sort === s.id && <Icon name="check" size={13} color="var(--primary)" style={{ marginLeft: 'auto' }} />}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <SidebarLabel>标签</SidebarLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 6px' }}>
              {allTags.map(t => <Tag key={t} active={activeTags.includes(t)} onClick={() => { toggleTag(t); goOverview(); }}>{t}</Tag>)}
            </div>
          </div>
        </div>

        {/* bottom: settings + theme */}
        <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setRoute('settings')}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, height: 34, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: route === 'settings' ? 'var(--primary-soft)' : 'transparent', color: route === 'settings' ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 550, transition: 'all .14s' }}>
            <Icon name="settings" size={16} /> 设置
          </button>
          <IconButton name={theme === 'dark' ? 'globe' : 'layers'} title={theme === 'dark' ? '切换浅色' : '切换深色'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* top bar */}
        <header style={{ height: 56, flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: 'var(--titlebar)', backdropFilter: 'blur(12px)' }}>
          {route === 'overview' ? (
            <React.Fragment>
              <div style={{ flex: 1, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
                <Icon name="search" size={15} color="var(--text-tertiary)" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索项目、路径、标签…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13.5, fontFamily: 'inherit' }} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={14} color="var(--text-tertiary)" /></button>}
                <kbd className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)' }}>⌘K</kbd>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }}>
                <IconButton name="grid" size={28} active={view === 'grid'} onClick={() => setView('grid')} title="网格" />
                <IconButton name="list" size={28} active={view === 'list'} onClick={() => setView('list')} title="列表" />
              </div>
              <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>添加项目</Button>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <Button variant="ghost" icon="chevronD" onClick={goOverview} style={{ transform: 'none' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ transform: 'rotate(90deg)', display: 'inline-flex' }}><Icon name="chevronR" size={14} /></span>返回</span>
              </Button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-tertiary)' }}>
                <span style={{ cursor: 'pointer' }} onClick={goOverview}>项目库</span>
                <Icon name="chevronR" size={13} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 550 }}>{route === 'settings' ? '设置' : selected?.name}</span>
              </div>
              <div style={{ flex: 1 }} />
            </React.Fragment>
          )}
        </header>

        {/* content */}
        <div style={{ flex: 1, overflowY: route === 'detail' ? 'hidden' : 'auto' }}>
          {route === 'overview' && (
            <div style={{ padding: '22px 28px 32px' }}>
              <Overview projects={filtered} loading={loading} view={view} onOpen={openProject} onToast={showToast} completenessOf={completenessOf}
                hasActiveFilters={hasFilters} onClearFilters={() => { setStatus('all'); setActiveTags([]); setSearch(''); }} onAdd={() => setAddOpen(true)} />
            </div>
          )}
          {route === 'detail' && selected && (
            <ProjectDetail project={selected} tab={tab} onTab={setTab} onBack={goOverview} onToast={showToast}
              archiveState={archives[selected.id]}
              onSaveArchive={(key, text) => saveArchive(selected.id, key, text)}
              onOpenDiff={(commit, mode) => setDiff({ open: true, commit, mode })}
              onOpenAI={() => setAiOpen(true)} />
          )}
          {route === 'settings' && <Settings theme={theme} onTheme={setTheme} onToast={showToast} onAdd={() => setAddOpen(true)} />}
        </div>
      </main>

      {/* overlays */}
      <DiffDrawer open={diff.open} onClose={() => setDiff(d => ({ ...d, open: false }))} commit={diff.commit} mode={diff.mode} project={selected} onToast={showToast} />
      <AIDrawer open={aiOpen} onClose={() => setAiOpen(false)} project={selected} onToast={showToast}
        onAdopt={(key, text) => selected && saveArchive(selected.id, key, text)} />
      <AddProjectModal open={addOpen} onClose={() => setAddOpen(false)} onToast={showToast} />
      <Toast toast={toast} />
    </div>
  );
}

function TrafficLights() {
  const [hover, setHover] = React.useState(false);
  const dot = (bg, sym) => (
    <span onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 12, height: 12, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(0,0,0,.5)', lineHeight: 1, cursor: 'default' }}>
      {hover ? sym : ''}
    </span>
  );
  return <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
    {dot('#ff5f57', '×')}{dot('#febc2e', '–')}{dot('#28c840', '+')}
  </div>;
}

function NavItem({ icon, label, count, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
        background: active ? 'var(--primary-soft)' : hover ? 'var(--surface-hover)' : 'transparent', color: active ? 'var(--primary)' : 'var(--text-primary)', fontSize: 13.5, fontWeight: 600, transition: 'all .14s' }}>
      <Icon name={icon} size={16} />
      {label}
      {count != null && <span style={{ marginLeft: 'auto', fontSize: 11.5, color: active ? 'var(--primary)' : 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", background: active ? 'transparent' : 'var(--surface-elevated)', padding: '1px 7px', borderRadius: 999 }}>{count}</span>}
    </button>
  );
}

function SidebarLabel({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 650, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', padding: '0 8px', marginBottom: 8 }}>{children}</div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
