/* ============================================================
   Memoir — Git tab & Archive tab
   ============================================================ */

// ============================================================
//  GIT TAB
// ============================================================
function GitTab({ p, onOpenDiff, onToast }) {
  if (!p.git.tracked) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Panel style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 15, background: 'var(--surface-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--text-tertiary)' }}>
            <Icon name="gitBranch" size={26} strokeWidth={1.4} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)' }}>这个项目还没有纳入 Git</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, maxWidth: 380, marginInline: 'auto' }}>
            初始化一个 Git 仓库,Memoir 就能为它记录每一次改动、还原历史脉络。这是给老项目「留痕」的第一步。
          </div>
          <div className="mono" style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 18, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'left' }}>
            <span style={{ color: 'var(--accent)' }}>$</span> git init &amp;&amp; git add -A
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button variant="primary" icon="gitBranch" onClick={() => onToast('已在 ' + p.path + ' 初始化 Git 仓库', 'success')}>初始化 Git 仓库</Button>
            <Button variant="ghost" icon="external" onClick={() => onToast('打开 Git 入门文档', 'info')}>了解更多</Button>
          </div>
        </Panel>
      </div>
    );
  }

  const m = gitMeta(p.git);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1100 }}>
      {/* status bar */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <GitStat icon="gitBranch" label="当前分支" value={p.git.branch} mono />
            <Divider />
            <GitStat icon="globe" label="远程" value={p.git.remote || '未配置'} mono dim={!p.git.remote} />
            <Divider />
            <div>
              <SectionLabel style={{ marginBottom: 6 }}>状态</SectionLabel>
              <GitBadge git={p.git} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" icon="arrowDown" onClick={() => onToast(p.git.behind > 0 ? `已拉取 ${p.git.behind} 个提交` : '已是最新', 'success')}>
              Pull{p.git.behind > 0 ? ` ${p.git.behind}` : ''}
            </Button>
            <Button variant="secondary" size="sm" icon="arrowUp" onClick={() => onToast(p.git.ahead > 0 ? `已推送 ${p.git.ahead} 个提交` : '没有可推送的提交', 'success')}>
              Push{p.git.ahead > 0 ? ` ${p.git.ahead}` : ''}
            </Button>
            <Button variant="primary" size="sm" icon="gitCommit" onClick={() => onOpenDiff(null, 'commit')}>
              Commit{p.git.state === 'dirty' ? ` ${p.git.changes}` : ''}
            </Button>
          </div>
        </div>
      </Panel>

      {/* uncommitted changes hint */}
      {p.git.state === 'dirty' && (
        <div onClick={() => onOpenDiff(null, 'changes')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
            background: 'var(--warning-soft)', border: '1px solid color-mix(in srgb, var(--warning) 30%, var(--border))' }}>
          <Icon name="alert" size={16} color="var(--warning)" />
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>有 {p.git.changes} 处未提交的改动</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>查看 Diff <Icon name="chevronR" size={13} /></span>
        </div>
      )}

      {/* commit history */}
      <div>
        <SectionLabel style={{ marginBottom: 12 }}>提交历史 · {p.commits.length}</SectionLabel>
        <Panel pad={0} style={{ overflow: 'hidden' }}>
          {p.commits.map((c, i) => <CommitRow key={c.hash} commit={c} last={i === p.commits.length - 1} onClick={() => onOpenDiff(c, 'commit')} />)}
        </Panel>
      </div>
    </div>
  );
}

function GitStat({ icon, label, value, mono, dim }) {
  return (
    <div>
      <SectionLabel style={{ marginBottom: 6 }}>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color="var(--text-tertiary)" />
        <span className={mono ? 'mono' : ''} style={{ fontSize: 13, fontWeight: 550, color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{value}</span>
      </div>
    </div>
  );
}
function Divider() { return <div style={{ width: 1, height: 30, background: 'var(--border)' }} />; }

function CommitRow({ commit, last, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', cursor: 'pointer',
        borderBottom: last ? 'none' : '1px solid var(--border)', background: hover ? 'var(--surface-hover)' : 'transparent', transition: 'background .12s' }}>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{commit.msg}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11.5, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          <span className="mono" style={{ color: 'var(--text-secondary)' }}>{commit.hash}</span>
          <span>·</span><span>{commit.author}</span><span>·</span><span>{commit.time}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--diff-add-text)' }}>+{commit.add}</span>
        <span className="mono" style={{ fontSize: 11.5, color: 'var(--diff-del-text)' }}>−{commit.del}</span>
        <Icon name="chevronR" size={15} color="var(--text-tertiary)" style={{ opacity: hover ? 1 : .3, transition: 'opacity .14s' }} />
      </div>
    </div>
  );
}

// ============================================================
//  ARCHIVE TAB
// ============================================================
const ARCHIVE_SECTIONS = [
  { key: 'positioning', label: '项目定位', icon: 'pin', hint: '这是什么、解决什么问题、给谁用' },
  { key: 'tech', label: '技术栈与设计', icon: 'package', hint: '用了什么、关键架构决策' },
  { key: 'deploy', label: '运行部署运维', icon: 'terminal', hint: '怎么跑起来、部署在哪、怎么维护' },
  { key: 'todos', label: '待办与已知问题', icon: 'inbox', hint: '还没做完的、踩过的坑' },
];

function ArchiveTab({ p, archiveState, onSaveArchive, onOpenAI, onToast }) {
  const filledCount = ARCHIVE_SECTIONS.filter(s => archiveState[s.key]?.filled).length;
  const empty = filledCount === 0;

  if (empty) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Panel style={{ padding: '36px 32px', textAlign: 'center', background: 'linear-gradient(180deg, var(--primary-soft), transparent 60%), var(--surface)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Icon name="sparkles" size={26} color="var(--primary)" />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>给「{p.name}」建一份档案</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 8, maxWidth: 440, marginInline: 'auto' }}>
            Memoir 会读取代码结构、README 与 Git 历史,自动生成四个分区的初稿。你只需校对、补充,几分钟就能让老项目重新「可读」。
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <Button variant="primary" icon="sparkles" onClick={onOpenAI}>AI 生成初稿</Button>
            <Button variant="ghost" icon="edit" onClick={() => onToast('从空白模板开始', 'info')}>手动填写</Button>
          </div>
          {/* template preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 26, textAlign: 'left' }}>
            {ARCHIVE_SECTIONS.map(s => (
              <div key={s.key} style={{ padding: 12, borderRadius: 10, border: '1px dashed var(--border-strong)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Icon name={s.icon} size={14} color="var(--text-tertiary)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 5, lineHeight: 1.45 }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SectionLabel>项目档案</SectionLabel>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>已填 {filledCount} / 4 分区</span>
        </div>
        <Button variant="secondary" size="sm" icon="sparkles" onClick={onOpenAI}>重新 AI 生成</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ARCHIVE_SECTIONS.map(s => (
          <ArchiveSection key={s.key} section={s} data={archiveState[s.key]} onSave={(text) => onSaveArchive(s.key, text)} onToast={onToast} />
        ))}
      </div>
    </div>
  );
}

function ArchiveSection({ section, data, onSave, onToast }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(data?.text || '');
  const filled = data?.filled;
  React.useEffect(() => { setDraft(data?.text || ''); }, [data]);

  return (
    <Panel pad={0} style={{ borderColor: editing ? 'var(--primary-ring)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: (filled || editing) ? '1px solid var(--border)' : 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: filled ? 'var(--success-soft)' : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={section.icon} size={15} color={filled ? 'var(--success)' : 'var(--text-tertiary)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>{section.label}</span>
            {filled
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--success)', fontWeight: 550 }}><Icon name="check" size={12} /> 已填</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--warning)', fontWeight: 550 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--warning)' }} /> 待填</span>}
          </div>
          {!filled && !editing && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{section.hint}</div>}
        </div>
        {!editing && <IconButton name="edit" size={30} title="编辑" onClick={() => setEditing(true)} />}
      </div>

      {editing ? (
        <div style={{ padding: 16 }}>
          <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            placeholder={section.hint + '…'}
            style={{
              width: '100%', minHeight: 110, resize: 'vertical', padding: 12, borderRadius: 8,
              background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)',
              fontSize: 13.5, lineHeight: 1.6, fontFamily: 'inherit', outline: 'none',
            }} className="focus-ring" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button variant="ghost" size="sm" onClick={() => { setDraft(data?.text || ''); setEditing(false); }}>取消</Button>
            <Button variant="primary" size="sm" icon="check" onClick={() => { onSave(draft); setEditing(false); onToast('已保存「' + section.label + '」', 'success'); }}>保存</Button>
          </div>
        </div>
      ) : filled ? (
        <div style={{ padding: 16, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{data.text}</div>
      ) : null}
    </Panel>
  );
}

Object.assign(window, { GitTab, CommitRow, ArchiveTab, ArchiveSection, ARCHIVE_SECTIONS });
