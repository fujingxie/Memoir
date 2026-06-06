# CHANGELOG

## 2026-06-06 — T1 脚手架与高保真 UI 复刻

- 新增 Tauri 2 + React/TypeScript/Vite 工程骨架。
- 新增 Tailwind、Zustand、shadcn-style `Button` primitive、`tauri-plugin-sql` 集成。
- 迁移 `design_handoff_memoir` 的主要界面与交互:
  - 项目总览、筛选/排序/搜索、网格/列表切换。
  - 项目详情 5 Tabs: 概览、文件结构、Git、项目档案、资料。
  - Diff 抽屉、AI 流式生成抽屉、添加项目弹窗、设置页。
- 新增 `DESIGN.md`、`STATUS.md`、`.gitignore`、Tauri 图标和 favicon。
- 验证:
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - `cargo check` in `src-tauri` 通过。
  - Playwright/Chrome 验证首屏、详情、Diff 抽屉、AI 抽屉、设置页,console errors 为空。
