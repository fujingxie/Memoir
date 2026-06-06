/* ============================================================
   Memoir — Drawers & Modals: Diff, AI generation, Add project, Commit
   ============================================================ */

// ---------- Drawer shell ----------
function Drawer({ open, onClose, width = 560, title, subtitle, icon, children, footer, accent = 'primary' }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s' }} />
      <div style={{
        position: 'relative', width, maxWidth: '92%', height: '100%', background: 'var(--surface)',
        borderLeft: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', animation: 'slideInRight .26s cubic-bezier(.22,.61,.36,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {icon && <div style={{ width: 34, height: 34, borderRadius: 9, background: `var(--${accent}-soft)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={icon} size={17} color={`var(--${accent})`} />
          </div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>{title}</div>
            {subtitle && <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          <IconButton name="x" onClick={onClose} title="关闭 (Esc)" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ flexShrink: 0, padding: '14px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-elevated)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ============================================================
//  DIFF DRAWER
// ============================================================
const DIFF_SAMPLE = [
  { file: 'src/ai/deepseek.ts', add: 42, del: 6, hunks: [
    { head: '@@ -18,7 +18,9 @@ export async function generate(', lines: [
      ['ctx', 'const messages = buildPrompt(repo);'], ['del', '  const res = await client.chat(messages);'],
      ['add', '  const stream = await client.chatStream(messages);'], ['add', '  for await (const chunk of stream) {'],
      ['add', '    onToken(chunk.delta);'], ['add', '  }'], ['ctx', '  return assemble();'],
    ]},
  ]},
  { file: 'src/renderer/ArchiveDrawer.tsx', add: 96, del: 8, hunks: [
    { head: '@@ -1,4 +1,6 @@', lines: [
      ['add', "import { useStream } from '../hooks/useStream';"], ['ctx', ''], ['ctx', 'export function ArchiveDrawer({ project }) {'],
      ['del', '  const [text, setText] = useState("");'], ['add', '  const { sections, adopt } = useStream(project);'],
    ]},
  ]},
];

function DiffDrawer({ open, onClose, commit, mode, project, onToast }) {
  const title = mode === 'commit' && commit ? commit.msg : mode === 'commit' ? '新建提交' : '未提交的改动';
  const sub = commit ? `${commit.hash} · ${commit.author} · ${commit.time}` : project?.path;
  const totalAdd = DIFF_SAMPLE.reduce((a, f) => a + f.add, 0);
  const totalDel = DIFF_SAMPLE.reduce((a, f) => a + f.del, 0);

  return (
    <Drawer open={open} onClose={onClose} width={640} icon="gitCommit" title={title} subtitle={sub} accent="accent">
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{DIFF_SAMPLE.length} 个文件改动</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--diff-add-text)' }}>+{totalAdd}</span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--diff-del-text)' }}>−{totalDel}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, height: 6, width: 120, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ flex: totalAdd, background: 'var(--success)' }} />
          <div style={{ flex: totalDel, background: 'var(--error)' }} />
        </div>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DIFF_SAMPLE.map((f, i) => <DiffFile key={i} file={f} />)}
      </div>
    </Drawer>
  );
}

function DiffFile({ file }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface-elevated)', cursor: 'pointer' }}>
        <Icon name="chevronR" size={12} color="var(--text-tertiary)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
        <Icon name="fileCode" size={14} color="var(--text-secondary)" />
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.file}</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--diff-add-text)' }}>+{file.add}</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--diff-del-text)' }}>−{file.del}</span>
      </div>
      {open && file.hunks.map((h, i) => (
        <div key={i} className="mono" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
          <div style={{ padding: '4px 12px', color: 'var(--info)', background: 'var(--info-soft)', fontSize: 11.5 }}>{h.head}</div>
          {h.lines.map(([type, text], j) => (
            <div key={j} style={{ display: 'flex', background: type === 'add' ? 'var(--diff-add)' : type === 'del' ? 'var(--diff-del)' : 'transparent', padding: '0 12px' }}>
              <span style={{ width: 14, flexShrink: 0, color: type === 'add' ? 'var(--diff-add-text)' : type === 'del' ? 'var(--diff-del-text)' : 'var(--text-tertiary)', userSelect: 'none' }}>{type === 'add' ? '+' : type === 'del' ? '−' : ' '}</span>
              <span style={{ color: type === 'add' ? 'var(--diff-add-text)' : type === 'del' ? 'var(--diff-del-text)' : 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{text || ' '}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
//  AI ARCHIVE GENERATION DRAWER (streaming + per-section adopt)
// ============================================================
function aiDraftFor(p) {
  return {
    positioning: `${p.name} 是一个${p.description || '本地代码项目'}。${p.techStack[0]} 技术栈,主要用于${p.tags.join('、')}相关场景。从 Git 历史看,项目自创建以来持续迭代,核心目标是${p.description ? '解决实际开发中的具体问题' : '探索与验证想法'}。`,
    tech: `技术栈以 ${p.techStack.join('、')} 为主。代码组织清晰,关键模块分布在 src/ 下。从提交记录可见近期在做${p.lastCommitMsg.includes('feat') ? '功能扩展' : p.lastCommitMsg.includes('fix') ? '缺陷修复' : '性能优化'},架构整体稳定。`,
    deploy: `${p.lang === 'rust' || p.lang === 'go' ? '编译为单一二进制分发' : p.lang === 'python' ? '通过 requirements.txt 还原环境后运行' : '通过包管理器安装依赖后启动'}。建议补充:环境变量、所需服务依赖、以及一键启动命令。`,
    todos: `根据 Git 状态推断:${p.git.state === 'dirty' ? `当前有 ${p.git.changes} 处未提交改动需要梳理;` : ''}${p.git.behind > 0 ? `落后远程 ${p.git.behind} 个提交,需要同步;` : ''}建议补充已知 bug 与下一步计划。`,
  };
}

const AI_SECTIONS = [
  { key: 'positioning', label: '项目定位', icon: 'pin' },
  { key: 'tech', label: '技术栈与设计', icon: 'package' },
  { key: 'deploy', label: '运行部署运维', icon: 'terminal' },
  { key: 'todos', label: '待办与已知问题', icon: 'inbox' },
];

function AIDrawer({ open, onClose, project, onAdopt, onToast }) {
  const draft = React.useMemo(() => project ? aiDraftFor(project) : {}, [project]);
  const [phase, setPhase] = React.useState('idle'); // idle | streaming | done
  const [activeIdx, setActiveIdx] = React.useState(-1);
  const [texts, setTexts] = React.useState({});
  const [adopted, setAdopted] = React.useState({});
  const timers = React.useRef([]);

  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setPhase('idle'); setActiveIdx(-1); setTexts({}); setAdopted({}); };

  React.useEffect(() => { if (open) startStream(); else reset(); /* eslint-disable-next-line */ }, [open]);

  function startStream() {
    reset();
    setTimeout(() => {
      setPhase('streaming');
      let delay = 300;
      AI_SECTIONS.forEach((s, si) => {
        const full = draft[s.key] || '';
        timers.current.push(setTimeout(() => setActiveIdx(si), delay));
        // reveal in chunks
        const chunk = 2;
        for (let i = 0; i <= full.length; i += chunk) {
          timers.current.push(setTimeout(() => {
            setTexts(t => ({ ...t, [s.key]: full.slice(0, i) }));
          }, delay + (i / chunk) * 16));
        }
        delay += (full.length / chunk) * 16 + 420;
      });
      timers.current.push(setTimeout(() => { setPhase('done'); setActiveIdx(-1); }, delay));
    }, 200);
  }

  const adoptOne = (key) => { setAdopted(a => ({ ...a, [key]: true })); onAdopt(key, draft[key]); onToast('已采纳「' + AI_SECTIONS.find(s => s.key === key).label + '」', 'success'); };
  const adoptAll = () => { AI_SECTIONS.forEach(s => { if (!adopted[s.key]) onAdopt(s.key, draft[s.key]); }); onToast('已采纳全部 4 个分区并保存档案', 'success'); onClose(); };

  const adoptedCount = Object.keys(adopted).length;

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        {phase === 'streaming' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="sparkles" size={13} color="var(--primary)" style={{ animation: 'pulse 1.2s infinite' }} /> 正在生成…</span>
          : `已采纳 ${adoptedCount} / 4 分区`}
      </div>
      <div style={{ flex: 1 }} />
      {phase === 'done' && <Button variant="ghost" size="sm" icon="refresh" onClick={startStream}>重新生成</Button>}
      <Button variant="primary" size="sm" icon="check" disabled={phase !== 'done'} onClick={adoptAll}>全部采纳并保存</Button>
    </div>
  );

  return (
    <Drawer open={open} onClose={onClose} width={580} icon="sparkles" accent="primary"
      title="AI 生成项目档案" subtitle={project ? `读取 ${project.name} 的代码 · README · Git 历史` : ''} footer={footer}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {AI_SECTIONS.map((s, si) => {
          const text = texts[s.key];
          const isActive = activeIdx === si;
          const isAdopted = adopted[s.key];
          const started = text !== undefined;
          return (
            <div key={s.key} style={{
              border: `1px solid ${isActive ? 'var(--primary-ring)' : isAdopted ? 'color-mix(in srgb, var(--success) 35%, var(--border))' : 'var(--border)'}`,
              borderRadius: 11, overflow: 'hidden', background: 'var(--surface)',
              opacity: started ? 1 : 0.5, transition: 'opacity .3s, border-color .3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', background: 'var(--surface-elevated)' }}>
                <Icon name={s.icon} size={15} color={isAdopted ? 'var(--success)' : 'var(--text-secondary)'} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{s.label}</span>
                {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />}
                <div style={{ flex: 1 }} />
                {isAdopted
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}><Icon name="check" size={13} /> 已采纳</span>
                  : started && !isActive ? <Button variant="secondary" size="sm" icon="check" onClick={() => adoptOne(s.key)}>采纳</Button> : null}
              </div>
              {started && (
                <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                  {text}{isActive && <span style={{ display: 'inline-block', width: 7, height: 15, background: 'var(--primary)', marginLeft: 1, verticalAlign: 'text-bottom', animation: 'caretBlink 1s steps(1) infinite' }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

// ============================================================
//  MODAL shell
// ============================================================
function Modal({ open, onClose, width = 480, children }) {
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)', animation: 'fadeIn .2s' }} />
      <div style={{ position: 'relative', width, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', animation: 'scaleIn .22s cubic-bezier(.22,.61,.36,1)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ---------- Add project / scan dir modal ----------
function AddProjectModal({ open, onClose, onToast }) {
  const [dir, setDir] = React.useState('~/dev');
  const [scanning, setScanning] = React.useState(false);
  const [found, setFound] = React.useState(0);

  React.useEffect(() => { if (open) { setScanning(false); setFound(0); setDir('~/dev'); } }, [open]);

  const scan = () => {
    setScanning(true); setFound(0);
    let n = 0; const t = setInterval(() => { n += Math.ceil(Math.random()*3); if (n >= 14) { n = 14; clearInterval(t); setScanning(false); } setFound(n); }, 180);
  };

  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="folderOpen" size={18} color="var(--primary)" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)' }}>添加扫描目录</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 2 }}>Memoir 会递归发现目录下的所有代码仓库</div>
        </div>
        <IconButton name="x" onClick={onClose} />
      </div>
      <div style={{ padding: 22 }}>
        <SectionLabel style={{ marginBottom: 8 }}>根目录路径</SectionLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
            <Icon name="folder" size={15} color="var(--text-tertiary)" />
            <input value={dir} onChange={e => setDir(e.target.value)} className="mono"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
          <Button variant="secondary" icon="dotGrid" onClick={() => onToast('打开系统目录选择器', 'info')}>浏览</Button>
        </div>

        <div style={{ marginTop: 18, padding: 16, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 11, minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {found === 0 && !scanning ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>点击「扫描」预览将发现的项目</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ position: 'relative', width: 40, height: 40 }}>
                {scanning && <Icon name="refresh" size={20} color="var(--primary)" style={{ position: 'absolute', inset: 10, animation: 'spin 1s linear infinite' }} />}
                {!scanning && <Icon name="checkCircle" size={26} color="var(--success)" style={{ position: 'absolute', inset: 7 }} />}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>{found} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>个项目</span></div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{scanning ? '正在扫描 ' + dir + ' …' : '扫描完成,可以导入'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-elevated)' }}>
        <Button variant="ghost" icon="refresh" onClick={scan} loading={scanning}>{scanning ? '扫描中' : '扫描'}</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" icon="plus" disabled={found === 0 || scanning} onClick={() => { onToast(`已导入 ${found} 个项目`, 'success'); onClose(); }}>导入 {found > 0 ? found : ''} 个项目</Button>
        </div>
      </div>
    </Modal>
  );
}

Object.assign(window, { Drawer, DiffDrawer, AIDrawer, Modal, AddProjectModal });
