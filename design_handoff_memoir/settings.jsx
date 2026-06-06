/* ============================================================
   Memoir — Settings page
   ============================================================ */

function Settings({ theme, onTheme, onToast, onAdd }) {
  const [dirs, setDirs] = React.useState(SCAN_DIRS);
  const [apiKey, setApiKey] = React.useState('sk-deepseek-••••••••••••3f9a');
  const [showKey, setShowKey] = React.useState(false);
  const [editor, setEditor] = React.useState('vscode');

  const editors = [
    { id: 'vscode', label: 'VS Code' }, { id: 'cursor', label: 'Cursor' },
    { id: 'webstorm', label: 'WebStorm' }, { id: 'zed', label: 'Zed' },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 28px 40px', animation: 'riseIn .26s' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>设置</h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 28 }}>所有配置仅保存在本机。</p>

      {/* Scan dirs */}
      <SettingsGroup icon="folderOpen" title="扫描根目录" desc="Memoir 会在这些目录下发现并索引代码项目">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dirs.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
              <Icon name="folder" size={15} color="var(--accent)" />
              <span className="mono" style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{d}</span>
              <IconButton name="x" size={28} danger title="移除" onClick={() => { setDirs(dirs.filter((_, j) => j !== i)); onToast('已移除扫描目录', 'info'); }} />
            </div>
          ))}
          <Button variant="secondary" icon="plus" size="sm" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={onAdd}>添加目录</Button>
        </div>
      </SettingsGroup>

      {/* DeepSeek key */}
      <SettingsGroup icon="sparkles" title="DeepSeek API Key" desc="用于 AI 自动生成项目档案,密钥存于系统钥匙串">
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 38, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 9 }}>
            <Icon name="command" size={14} color="var(--text-tertiary)" />
            <input value={showKey ? 'sk-deepseek-a91c47f29b3f9a' : apiKey} onChange={e => setApiKey(e.target.value)} type="text" className="mono"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }} />
            <button onClick={() => setShowKey(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 12 }}>{showKey ? '隐藏' : '显示'}</button>
          </div>
          <Button variant="secondary" icon="check" onClick={() => onToast('API Key 已验证有效', 'success')}>验证</Button>
        </div>
      </SettingsGroup>

      {/* Default editor */}
      <SettingsGroup icon="terminal" title="默认编辑器" desc="点击「编辑器打开」时使用">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {editors.map(e => (
            <button key={e.id} onClick={() => { setEditor(e.id); onToast('默认编辑器已设为 ' + e.label, 'info'); }}
              style={{
                padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 550,
                background: editor === e.id ? 'var(--primary-soft)' : 'var(--bg)',
                border: `1px solid ${editor === e.id ? 'var(--primary-ring)' : 'var(--border)'}`,
                color: editor === e.id ? 'var(--primary)' : 'var(--text-secondary)', transition: 'all .14s',
              }}>{e.label}</button>
          ))}
        </div>
      </SettingsGroup>

      {/* Theme */}
      <SettingsGroup icon="layers" title="主题" desc="深色 / 浅色外观">
        <div style={{ display: 'flex', gap: 10 }}>
          {[{ id: 'dark', label: '深色', bg: '#0E0F13', fg: '#E6E8EC' }, { id: 'light', label: '浅色', bg: '#F5F6F8', fg: '#1A1D23' }].map(t => (
            <button key={t.id} onClick={() => onTheme(t.id)}
              style={{
                flex: 1, padding: 14, borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                background: 'var(--bg)', border: `2px solid ${theme === t.id ? 'var(--primary)' : 'var(--border)'}`, transition: 'border-color .14s',
              }}>
              <div style={{ height: 52, borderRadius: 8, background: t.bg, border: '1px solid var(--border)', padding: 8, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ width: '60%', height: 7, borderRadius: 3, background: t.fg, opacity: .9 }} />
                <div style={{ width: '40%', height: 6, borderRadius: 3, background: '#6366F1' }} />
                <div style={{ width: '75%', height: 6, borderRadius: 3, background: t.fg, opacity: .3 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${theme === t.id ? 'var(--primary)' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {theme === t.id && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
              </div>
            </button>
          ))}
        </div>
      </SettingsGroup>

      {/* About */}
      <SettingsGroup icon="bookOpen" title="关于" desc="" last>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="bookOpen" size={22} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text-primary)' }}>Memoir <span className="mono" style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>v0.4.1</span></div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>本机所有代码项目的记忆库 · 纯本地、单用户</div>
          </div>
          <Button variant="ghost" size="sm" icon="external" onClick={() => onToast('打开更新日志', 'info')}>更新日志</Button>
        </div>
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({ icon, title, desc, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 24, paddingBottom: last ? 0 : 24, borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: desc ? 4 : 12 }}>
        <Icon name={icon} size={16} color="var(--text-secondary)" />
        <h2 style={{ fontSize: 15, fontWeight: 650, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {desc && <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginBottom: 14, marginLeft: 25 }}>{desc}</p>}
      <div style={{ marginLeft: 25 }}>{children}</div>
    </div>
  );
}

Object.assign(window, { Settings, SettingsGroup });
