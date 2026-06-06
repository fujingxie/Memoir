/* ============================================================
   Memoir — Project detail: header, tab nav, Overview/Files/Docs tabs
   ============================================================ */

const TABS = [
  { id: 'overview', label: '概览', icon: 'layers' },
  { id: 'files', label: '文件结构', icon: 'folder' },
  { id: 'git', label: 'Git', icon: 'gitBranch' },
  { id: 'archive', label: '项目档案', icon: 'bookOpen' },
  { id: 'docs', label: '资料', icon: 'link' },
];

function ProjectDetail({ project, tab, onTab, onBack, onToast, onOpenDiff, onOpenAI, archiveState, onSaveArchive }) {
  const p = project;
  const archiveCount = ['positioning','tech','deploy','todos'].filter(k => archiveState[k]?.filled).length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'riseIn .26s' }}>
      {/* project header */}
      <div style={{ padding: '20px 28px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, minWidth: 0 }}>
            <CompletenessRing value={archiveCompleteness(archiveState, p)} size={56} stroke={4.5} animate={false} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LangDot lang={p.lang} size={10} />
                <h1 style={{ fontSize: 23, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{p.name}</h1>
                <StatusBadge status={p.status} />
              </div>
              <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.path}
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{LANGS[p.lang]?.label}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Button variant="secondary" icon="terminal" onClick={() => onToast(`正在用 VS Code 打开 ${p.name}…`, 'info')}>编辑器</Button>
            <Button variant="primary" icon="folderOpen" onClick={() => onToast(`已在访达中打开 ${p.path}`, 'info')}>打开目录</Button>
          </div>
        </div>

        {/* tab nav */}
        <div style={{ display: 'flex', gap: 2, marginTop: 18, borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => {
            const active = t.id === tab;
            const showDot = t.id === 'archive' && archiveCount < 4;
            return (
              <button key={t.id} onClick={() => onTab(t.id)} className="focus-ring"
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', position: 'relative',
                  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 13.5, fontWeight: active ? 600 : 500,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'color .14s',
                }}>
                <Icon name={t.icon} size={15} color={active ? 'var(--primary)' : 'currentColor'} />
                {t.label}
                {showDot && <span title="档案待补全" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />}
                {active && <span style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, background: 'var(--primary)', borderRadius: 2 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 32px' }}>
        {tab === 'overview' && <OverviewTab p={p} archiveState={archiveState} onTab={onTab} onOpenAI={onOpenAI} />}
        {tab === 'files' && <FilesTab p={p} />}
        {tab === 'git' && <GitTab p={p} onOpenDiff={onOpenDiff} onToast={onToast} />}
        {tab === 'archive' && <ArchiveTab p={p} archiveState={archiveState} onSaveArchive={onSaveArchive} onOpenAI={onOpenAI} onToast={onToast} />}
        {tab === 'docs' && <DocsTab p={p} onToast={onToast} />}
      </div>
    </div>
  );
}

function archiveCompleteness(archiveState, p) {
  return computeCompleteness(p, archiveState);
}

// ============================================================
//  OVERVIEW TAB
// ============================================================
function OverviewTab({ p, archiveState, onTab, onOpenAI }) {
  const missing = [
    { key: 'positioning', label: '项目定位' },
    { key: 'tech', label: '技术栈与设计' },
    { key: 'deploy', label: '运行部署运维' },
    { key: 'todos', label: '待办与已知问题' },
  ].filter(m => !archiveState[m.key]?.filled);
  const hasArchive = archiveState.positioning?.filled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      {/* archive summary */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <PanelTitle icon="bookOpen">档案摘要</PanelTitle>
          <Button variant="ghost" size="sm" icon="chevronR" iconRight="" onClick={() => onTab('archive')}>查看完整档案</Button>
        </div>
        {hasArchive
          ? <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{archiveState.positioning.text}</p>
          : <EmptyState compact icon="sparkles" title="这个项目还没有档案" body="用 AI 根据代码、README 和 Git 记录自动生成一份初稿,几秒看懂这是什么、怎么跑。" action={<Button variant="primary" icon="sparkles" onClick={onOpenAI}>AI 生成初稿</Button>} />}
      </Panel>

      {/* key info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <InfoCard icon="package" label="技术栈">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {p.techStack.map(t => <Tag key={t}>{t}</Tag>)}
          </div>
        </InfoCard>
        <InfoCard icon="gitCommit" label="最近活动">
          {p.commits.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45 }}>{p.lastCommitMsg}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span className="mono">{p.lastCommitHash}</span>
                <span>·</span>
                <span>{p.lastCommit}</span>
              </div>
            </div>
          ) : <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>暂无提交记录</div>}
        </InfoCard>
        <InfoCard icon="layers" label="完整度">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <CompletenessRing value={archiveCompleteness(archiveState, p)} size={52} stroke={4.5} animate={false} />
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              4 个档案分区<br/>已填 {['positioning','tech','deploy','todos'].filter(k => archiveState[k]?.filled).length} / 4
            </div>
          </div>
        </InfoCard>
      </div>

      {/* 待补提醒 */}
      {missing.length > 0 && (
        <Panel accent="warning">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="alert" size={17} color="var(--warning)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>还有 {missing.length} 个档案分区待补全</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 3, marginBottom: 10 }}>补全后,这个项目即使放上一年也能秒懂。</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {missing.map(m => <Tag key={m.key} onClick={() => onTab('archive')}>{m.label}</Tag>)}
              </div>
            </div>
            <Button variant="primary" size="sm" icon="sparkles" onClick={onOpenAI}>AI 补全</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ============================================================
//  FILES TAB
// ============================================================
const FAKE_CODE = {
  default: ["// 选择左侧文件以预览(只读)", "// Memoir 不会修改你的任何文件"],
  'package.json': ['{', '  "name": "memoir",', '  "version": "0.4.1",', '  "private": true,', '  "main": "dist/main/index.js",', '  "scripts": {', '    "dev": "vite",', '    "build": "electron-builder"', '  }', '}'],
  'README.md': ['# memoir', '', '> 本机所有代码项目的记忆库。', '', '统一查看项目结构、Git 记录与文档,', '并为久远项目用 AI 自动生成档案。', '', '## 开发', '', '```bash', 'pnpm i && pnpm dev', '```'],
  'scanner.ts': ['import { readdir } from "fs/promises";', '', 'export async function scan(root: string) {', '  const entries = await readdir(root, {', '    withFileTypes: true,', '  });', '  return entries.filter(isRepo);', '}'],
  'main.rs': ['fn main() {', '    let args = Cli::parse();', '    match args.cmd {', '        Cmd::Log { msg } => store::append(&msg),', '        Cmd::Tui => tui::run(),', '    }', '}'],
};

function FilesTab({ p }) {
  const [selected, setSelected] = React.useState(null);
  const code = (selected && FAKE_CODE[selected]) || FAKE_CODE.default;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, height: '100%', minHeight: 420 }}>
      <Panel pad={8} style={{ overflowY: 'auto' }}>
        <FileTree node={p.files} depth={0} selected={selected} onSelect={setSelected} defaultOpen />
      </Panel>
      <Panel pad={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>
          <Icon name={selected ? 'fileCode' : 'file'} size={14} color="var(--text-tertiary)" />
          <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{selected || '未选择文件'}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--border)' }}>只读</span>
        </div>
        <div className="mono" style={{ flex: 1, overflow: 'auto', padding: '14px 0', fontSize: 13, lineHeight: 1.7 }}>
          {code.map((line, i) => (
            <div key={i} style={{ display: 'flex', padding: '0 16px' }}>
              <span style={{ width: 32, flexShrink: 0, color: 'var(--text-tertiary)', userSelect: 'none', textAlign: 'right', paddingRight: 16 }}>{i + 1}</span>
              <span style={{ color: line.startsWith('//') || line.startsWith('>') ? 'var(--text-tertiary)' : 'var(--text-primary)', whiteSpace: 'pre' }}>{line || ' '}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function FileTree({ node, depth, selected, onSelect, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen || depth < 1);
  const isFolder = node.type === 'folder';
  const [hover, setHover] = React.useState(false);
  const active = selected === node.name;

  return (
    <div>
      <div
        onClick={() => isFolder ? setOpen(o => !o) : onSelect(node.name)}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 28, paddingRight: 8,
          paddingLeft: 6 + depth * 14, borderRadius: 6, cursor: 'pointer',
          background: active ? 'var(--primary-soft)' : hover ? 'var(--surface-hover)' : 'transparent',
          color: active ? 'var(--primary)' : 'var(--text-secondary)', transition: 'background .12s',
        }}>
        {isFolder
          ? <Icon name="chevronR" size={12} color="var(--text-tertiary)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
          : <span style={{ width: 12, flexShrink: 0 }} />}
        <Icon name={isFolder ? (open ? 'folderOpen' : 'folder') : 'file'} size={14} color={isFolder ? 'var(--accent)' : active ? 'var(--primary)' : 'var(--text-tertiary)'} />
        <span className="mono" style={{ fontSize: 12.5, fontWeight: isFolder ? 550 : 400, color: active ? 'var(--primary)' : isFolder ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{node.name}</span>
      </div>
      {isFolder && open && node.children && (
        <div>
          {node.children.map((c, i) => <FileTree key={i} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  DOCS TAB
// ============================================================
function DocsTab({ p, onToast }) {
  const [docs, setDocs] = React.useState(p.docs);
  if (docs.length === 0) {
    return <EmptyState icon="link" title="还没有关联资料" body="把设计稿、需求文档、相关链接挂到这个项目下,下次回来一处可达。" action={<Button variant="primary" icon="plus" onClick={() => onToast('打开「添加资料」', 'info')}>添加资料</Button>} />;
  }
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <SectionLabel>关联资料 · {docs.length}</SectionLabel>
        <Button variant="secondary" size="sm" icon="plus" onClick={() => onToast('打开「添加资料」', 'info')}>添加</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map((d, i) => <DocRow key={i} doc={d} onToast={onToast} />)}
      </div>
    </div>
  );
}

function DocRow({ doc, onToast }) {
  const [hover, setHover] = React.useState(false);
  const isLink = doc.type === 'link';
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onToast(isLink ? `打开链接 ${doc.name}` : `预览文件 ${doc.name}`, 'info')}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
        background: hover ? 'var(--surface-hover)' : 'var(--surface)', border: '1px solid var(--border)',
        borderColor: hover ? 'var(--border-strong)' : 'var(--border)', transition: 'all .14s',
      }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={isLink ? 'globe' : 'file'} size={16} color={isLink ? 'var(--info)' : 'var(--text-secondary)'} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 550, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{doc.meta}</div>
      </div>
      <Icon name={isLink ? 'external' : 'chevronR'} size={15} color="var(--text-tertiary)" style={{ opacity: hover ? 1 : .4, transition: 'opacity .14s' }} />
    </div>
  );
}

// ---------- Shared panel helpers ----------
function Panel({ children, pad = 18, accent, style = {} }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: pad, position: 'relative', overflow: 'hidden',
      ...(accent ? { borderColor: `color-mix(in srgb, var(--${accent}) 35%, var(--border))` } : {}),
      ...style,
    }}>{children}</div>
  );
}
function PanelTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>
      {icon && <Icon name={icon} size={16} color="var(--text-secondary)" />}{children}
    </div>
  );
}
function InfoCard({ icon, label, children }) {
  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
        <Icon name={icon} size={14} color="var(--text-tertiary)" />
        <SectionLabel>{label}</SectionLabel>
      </div>
      {children}
    </Panel>
  );
}

Object.assign(window, { ProjectDetail, OverviewTab, FilesTab, FileTree, DocsTab, Panel, PanelTitle, InfoCard, archiveCompleteness, TABS });
