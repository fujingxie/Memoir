# STATUS

## 已上线功能

- T1 脚手架: Tauri 2 + React 18 + TypeScript + Vite + Tailwind + Zustand。
- 高保真前端复刻: 项目总览、详情 5 Tabs、设置页、Diff 抽屉、AI 流式抽屉、添加项目弹窗。
- 主题切换: 深色/浅色通过 `data-theme` 与 `localStorage["memoir-theme"]` 持久化。
- 示例 Tauri 命令: `get_memoir_status` 返回连接状态,前端设置页显示。
- `tauri-plugin-sql` 已接入 Rust builder,等待 T2 schema/迁移。

## 进行中 / 待处理项

- T2: SQLite schema 与首次启动迁移。
- T3+: 项目扫描、Git 读取、档案持久化、DeepSeek 转发和资料关联仍为 mock 交互。
- `pnpm` 当前未在 PATH 中;本轮使用 `/tmp/pnpm-macos/package/pnpm` 和 `/usr/local/bin/npm` 验证。

## 已知问题和技术债务

- 真实 `pnpm tauri dev` 依赖用户环境 PATH 中存在 pnpm;当前仓库已具备脚本和 Tauri 配置。
- `node_modules` 是本地验证产物,已通过 `.gitignore` 排除。
- AI 文案流式输出目前是 mock 数据,不是 DeepSeek 调用。

## 关键架构决策及原因

- 先完成 T1 与高保真 UI 迁移,不越级实现 T2-T9 后端;符合任务序列依赖。
- 设计 token 集中在 `src/styles/tokens.css`,组件只引用 CSS 变量,便于后续主题和 shadcn 对齐。
- 业务状态集中在 Zustand store,便于后续把 mock 数据替换成 Tauri invoke 数据源。

