# CHANGELOG

## 2026-06-16 — T13 图标、资料选择器与概览数据完善

- 更新 `src-tauri/tauri.conf.json` 与 `src-tauri/icons/`:
  - 从现有 `icon.png` 生成 `32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`。
  - bundle 图标配置接入上述资源,macOS `.app` 不再使用默认空白图标。
- 更新 `src-tauri/src/docs.rs` / `src-tauri/src/db/schema.sql` / `src-tauri/src/projects.rs`:
  - `documents.type` 扩展为 `local_file / local_dir / link`。
  - 旧数据库启动时自动重建 `documents` 表以放宽 CHECK 约束,并保留原有资料记录。
  - `open_document` 支持用系统默认程序打开本地文件夹。
  - `list_projects` / `get_project` 返回即时推断的技术栈和最新 Git 提交摘要。
- 更新 `src-tauri/src/settings.rs` / `src-tauri/src/lib.rs`:
  - 新增 `pick_file(initial_path)` Tauri 命令。
  - 添加资料弹窗可分别选择本地文件和本地文件夹。
- 更新 `src/lib/types.ts` / `src/lib/projects-api.ts` / `src/features/ProjectDetail.tsx` / `src/features/Overview.tsx`:
  - 前端资料类型新增 `folder`。
  - 详情页资料弹窗新增「本地文件夹」选项和本机选择器。
  - 概览技术栈展示接入后端推断结果,空态显示「暂未识别」。
  - 最近活动对 Git 项目显示最新提交,对非 Git 项目显示最近打开时间。
- 验证:
  - `cargo fmt --check` 通过。
  - `cargo test` in `src-tauri` 通过,39 个单元测试全绿。
  - `npm run build` 通过。
  - `git diff --check` 通过。
  - `npm run tauri -- build --bundles app` 通过,生成 `/Users/xiexiansheng/Documents/ClaudeProject/Project/WebProject/Memoir/src-tauri/target/release/bundle/macos/Memoir.app`。

## 2026-06-11 — T12 Codex / Claude Code 聊天记录关联

- 更新 `src-tauri/src/db/schema.sql` / `src-tauri/src/projects.rs`:
  - `chat_links.source` 扩展为 `claude / chatgpt / claude_code / codex`。
  - 旧数据库启动时自动重建 `chat_links` 表以放宽 CHECK 约束,并保留已有聊天记录。
- 更新 `src-tauri/src/chats.rs`:
  - `import_chat_export(file)` 新增 Codex JSONL 和 Claude Code JSONL 解析。
  - 新增 `read_chat_link_detail(id, chat_id)`,已关联的导出文件可重新读取源文件并生成可读正文。
  - 新增 `scan_local_chat_exports(input)`:
    - Codex 默认扫描 `~/.codex/sessions/**/*.jsonl`。
    - Claude Code 默认扫描 `~/.claude/projects/**/*.jsonl`,跳过 `subagents`。
  - 新增 Codex JSONL / Claude Code JSONL 扫描和详情解析单元测试。
- 更新 `src-tauri/src/lib.rs`,注册 `scan_local_chat_exports` / `read_chat_link_detail` Tauri 命令。
- 更新 `src/lib/types.ts` / `src/lib/projects-api.ts`:
  - 聊天来源类型新增 `claude_code` 和 `codex`。
  - 新增本地会话扫描和聊天详情读取 invoke 封装。
- 更新 `src/features/ProjectDetail.tsx`:
  - 「关联聊天」来源新增 Claude Code / Codex。
  - 导入模式新增「扫描 Codex」「扫描 Claude Code」快捷入口。
  - 聊天记录列表正确展示 Claude Code / Codex 标签。
  - 修复扫描结果已选中时仍提示必须输入导出文件路径的问题。
  - 点击已关联的导出文件聊天会打开站内详情弹窗,并提供「在 Finder 中显示」定位原文件。
- 更新 `src/styles/app.css`,新增聊天详情弹窗的宽屏和正文滚动样式。
- 验证:
  - `cargo fmt --check` 通过。
  - `cargo test` in `src-tauri` 通过,37 个单元测试全绿。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit` 通过。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vite build` 通过。
  - `git diff --check` 通过。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tauri dev` 可启动到运行态。

## 2026-06-08 — T11 聊天记录关联

- 新增 `src-tauri/src/chats.rs`:
  - `import_chat_export(file)`: 解析 ChatGPT 官方 JSON 导出、Claude JSON 导出和 Markdown 导出,返回可选择的对话候选。
  - `list_chat_links(id)`: 读取项目已关联聊天记录。
  - `add_chat_link(id, link)`: 保存 Claude / ChatGPT 分享链接或导出文件关联到 `chat_links`。
  - `open_chat_link(id, chat_id)`: 使用系统默认程序打开分享链接或导出文件。
  - `delete_chat_link(id, chat_id)`: 删除项目聊天记录关联。
  - 新增 ChatGPT JSON、Claude JSON、分享链接校验单元测试。
- 更新 `src-tauri/src/lib.rs`,注册 T11 的 5 个 Tauri 命令。
- 更新 `src/lib/types.ts` / `src/lib/projects-api.ts`:
  - 新增 `ProjectChatLink`、聊天来源/类型和导入候选类型。
  - 新增聊天记录 list/add/open/delete/import invoke 封装。
- 更新 `src/features/ProjectDetail.tsx`:
  - 资料 Tab 新增「聊天记录」区。
  - 支持保存 Claude / ChatGPT 分享链接。
  - 支持输入导出文件路径、解析候选对话、选择一条对话后关联。
  - 已关联聊天记录可打开和删除。
- 验证:
  - `cargo fmt --check` 通过。
  - `cargo test` in `src-tauri` 通过,32 个单元测试全绿。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit` 通过。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vite build` 通过。
  - `git diff --check` 通过。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tauri dev` 可启动到运行态。
  - 本轮 Codex 内置 Browser 返回 `Browser is not available: iab`,未完成截图式 UI 验证。

## 2026-06-08 — App 启动失败修复

- 修复 Tauri dev 启动前置命令失败:
  - 更新 `src-tauri/tauri.conf.json`,将 `npm run dev` 改为直接执行 `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 1420`。
  - 将 `npm run build` 改为直接执行本地 TypeScript 和 Vite 构建脚本,避免当前环境 PATH 中没有 `npm` 时 app 无法启动。
- 修复 SQL 插件启动 panic:
  - 更新 `src-tauri/src/lib.rs`,保留 `tauri-plugin-sql` 能力注册,但移除历史 migration 注册。
  - 更新 `src-tauri/src/db/mod.rs` / `src-tauri/src/projects.rs`,数据库建表继续由 Rust 后端 `database_pool` 幂等执行。
  - 恢复 `src-tauri/src/db/schema.sql` 为基础建表 schema,分类字段继续由 `ensure_schema_compat` 对旧库补齐。
- 验证:
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tauri dev` 可启动,Tauri 主进程保持运行。
  - `curl -I http://127.0.0.1:1420/` 返回 200。
  - Browser 打开 `http://127.0.0.1:1420/` 非白屏,console error 为 0。
  - `cargo fmt --check` 通过。
  - `cargo test` in `src-tauri` 通过,29 个单元测试全绿。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit && PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vite build` 通过。
  - `git diff --check` 通过。

## 2026-06-08 — 项目分类与分类编辑器

- 更新 `src-tauri/src/projects.rs`:
  - `projects` 表通过兼容迁移新增 `category` 字段和固定枚举约束。
  - 旧数据库首次访问时自动补齐 `category` 列,并按现有项目路径回填分类。
  - 扫描、手动添加、列表、详情均返回项目分类。
  - 新增 `set_project_category(id, category)` 支持详情页手动覆盖分类。
  - 新增 Android、iOS、小程序、Web、Desktop、Backend、CLI、Library、Other 分类识别测试。
- 更新 `src-tauri/src/settings.rs`:
  - 设置新增 `category_editors`,支持按分类覆盖默认编辑器。
  - 编辑器 preset 扩展为 VS Code、Cursor、WebStorm、Zed、Android Studio、Xcode、微信开发者工具。
  - `open_project_editor(id)` 改为按项目分类解析编辑器；macOS GUI 编辑器优先使用 `open -a <AppName> <path>`,失败后再尝试 CLI fallback。
  - 新增分类编辑器解析、优先级和打开命令构造测试。
- 更新 `src/lib/categories.ts` / `src/lib/types.ts` / `src/lib/projects-api.ts` / `src/store/useMemoirStore.ts`:
  - 前端新增固定分类常量、分类标签、编辑器 preset 常量和 API 封装。
  - Store 支持分类筛选和项目分类乐观更新。
- 更新 `src/App.tsx` / `src/features/Overview.tsx` / `src/features/ProjectDetail.tsx` / `src/features/Settings.tsx` / `src/styles/app.css`:
  - 侧栏新增分类筛选区并显示计数,关注清单保留。
  - 总览卡片和列表行显示独立分类 chip。
  - 项目详情顶部新增分类下拉。
  - 设置页新增「分类编辑器」区域,每个分类可继承默认或指定编辑器。
- 验证:
  - `cargo fmt --check` 通过。
  - `cargo test` in `src-tauri` 通过,29 个单元测试全绿。
  - `PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/tsc --noEmit && PATH=/Users/xiexiansheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vite build` 通过。
  - `git diff --check` 通过。
  - Browser 以 `http://127.0.0.1:1420/` 验证分类筛选、分类 chip、详情分类下拉和设置页分类编辑器。
  - 本次未重新打包。

## 2026-06-08 — 关注清单与卡片摘要收口

- 更新 `src/App.tsx` / `src/store/useMemoirStore.ts` / `src/lib/types.ts`:
  - 侧栏「排序」改为「关注」行动清单。
  - 支持需补档案、有未提交、未上传 GitHub、非 Git 项目、长期未打开、无关联资料筛选。
  - 排序移动到总览顶部工具栏下拉。
  - 运行时项目列表改为拉全量后在前端组合状态、关注、标签、搜索和排序。
- 更新 `src/features/Overview.tsx` / `src/styles/app.css`:
  - 卡片摘要显示前剥离 Markdown 标记。
  - 网格卡片固定高度,摘要限制 3 行；列表摘要保持 2 行。
- 更新 `src-tauri/src/projects.rs` / `src/lib/projects-api.ts`:
  - `list_projects` 返回 `docs_count`,用于准确判断「无关联资料」。
- 验证:
  - `git diff --check` 通过。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - `cargo test` in `src-tauri` 通过,26 个单元测试全绿。
  - Browser 以 `http://127.0.0.1:1420/` 验证桌面网格、列表模式和「需补档案」关注筛选。
  - 本次未重新打包。

## 2026-06-08 — 总览列表模式整理

- 更新 `src/features/Overview.tsx`:
  - 列表模式改为独立渲染结构,不再复用网格卡片的纵向内容布局。
  - 项目身份、档案完整度、摘要、标签/Git 状态和打开操作分区展示。
- 更新 `src/styles/app.css`:
  - 列表行使用稳定 grid 列布局,摘要限制为 2 行。
  - 较窄窗口下列表行自动折为两行元信息布局,避免横向硬挤。
- 验证:
  - `git diff --check` 通过。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 尝试打开 `127.0.0.1:5173` / `localhost:5173` 被当前会话拦截,未完成浏览器截图验证。
  - 本次未重新打包。

## 2026-06-08 — 桌面窗口壳层修复

- 修复自绘交通灯按钮无效:
  - 更新 `src/lib/projects-api.ts`,使用 `@tauri-apps/api/core` 官方 `isTauri()` 参与 runtime 判断。
  - 更新 `src-tauri/capabilities/default.json`,显式允许 `core:window:allow-close`、`allow-minimize`、`allow-toggle-maximize`。
- 修复整屏灰色背景包裹:
  - 更新 `src/styles/app.css`,移除 `.app-viewport` 的 28px padding。
  - `.desktop-window` 改为铺满窗口,去掉内嵌窗口的宽高限制、圆角、边框和投影。
- 验证:
  - `git diff --check` 通过。
  - `cargo test` in `src-tauri` 通过,26 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - 本次按用户要求未重新打包。

## 2026-06-08 — GitHub Token 系统钥匙串保存

- 新增 `src-tauri/src/secrets.rs`:
  - 使用 `keyring` crate 将 GitHub Token 保存到系统钥匙串。
  - 新增 `get_github_token_status()`、`save_github_token(token)` Tauri 命令。
  - 状态接口只返回 masked token,不返回明文。
- 更新 `src-tauri/src/git.rs`:
  - `git_publish_to_github` 的 token 改为可选。
  - 发布时优先使用表单临时 Token；留空时读取系统钥匙串中的已保存 Token。
  - 两边都没有 Token 时返回明确错误。
- 更新 `src/features/Settings.tsx`,新增 GitHub Token 设置块,支持保存、显示/隐藏、清空和 masked 状态展示。
- 更新 `src/features/ProjectDetail.tsx`,发布表单里的 GitHub Token 改为可选覆盖值,已保存时可留空。
- 更新 `src/lib/projects-api.ts`,新增 GitHub Token 状态/保存 invoke 封装。
- 更新 `src-tauri/Cargo.toml` / `Cargo.lock`,新增 `keyring` 与 macOS Security Framework 相关依赖。
- 验证:
  - `git diff --check` 通过。
  - `cargo test` in `src-tauri` 通过,26 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - 本次按用户要求未重新打包。

## 2026-06-08 — GitHub 首次发布能力

- 新增 `src-tauri/src/git.rs` 的 `git_publish_to_github(id, input)`:
  - 非 Git 项目会先执行 `git init`、`git add -A` 和首次 commit。
  - 通过 GitHub REST API 创建仓库,默认推送到 `main`,可选择私有/公开。
  - 首次 push 使用临时认证 URL,本地 `origin` 保存为不含 Token 的 `https://github.com/...git`。
  - 新增 GitHub 仓库名校验与 token userinfo percent encode 单元测试。
- 更新 `src-tauri/src/lib.rs`,注册 `git_publish_to_github` Tauri 命令。
- 更新 `src/lib/projects-api.ts`,新增 GitHub 发布 invoke 封装。
- 更新 `src/features/ProjectDetail.tsx`:
  - 非 Git 项目的 Git Tab 增加「发布到 GitHub」入口。
  - 支持填写仓库名、分支、一次性 GitHub Token、首次提交信息和私有仓库开关。
  - 发布成功后清空 Token 并刷新 Git 状态。
- 验证:
  - `git diff --check` 通过。
  - `cargo test` in `src-tauri` 通过,25 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证非 Git 项目 Git Tab 的 GitHub 发布表单渲染正常,console errors 为空。
  - 本次按用户要求未重新打包。

## 2026-06-08 — T10 打磨与总览摘要回退修复

- 完成 T10 收口:
  - 设置页接入扫描目录、默认编辑器、主题切换和关于信息。
  - 项目卡片与详情页的「打开目录 / 编辑器」接入本机命令。
  - Tauri 配置切换为 `npm run dev` / `npm run build`,bundle identifier 改为 `dev.memoir.desktop`。
  - 关闭原生标题栏并使用自绘交通灯,避免 macOS 窗口出现两套关闭按钮。
  - 添加项目弹窗的「浏览」按钮接入 `pick_directory` 本机目录选择命令。
- 修复切换排序后已补完档案的项目卡片变回红色占位:
  - 更新 `src-tauri/src/projects.rs`, `list_projects` / `get_project` 会读取 `.memoir/archive.md` 中的「项目定位」段并返回 `archive_positioning`。
  - 更新 `src/lib/projects-api.ts`,将 `archive_positioning` 映射为卡片 `description`。
  - 更新 `src/store/useMemoirStore.ts`,列表刷新时按项目 ID 合并已有 `archive` / `description`,避免排序重新拉库覆盖刚保存的摘要。
- 验证:
  - `git diff --check` 通过。
  - `cargo test` in `src-tauri` 通过,24 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - 本次按用户要求未重新打包。

## 2026-06-06 — T9 文档关联

- 新增 `src-tauri/src/docs.rs`:
  - `list_documents(id)`: 读取项目关联资料列表。
  - `add_document(id, document)`: 添加本地文件或外链资料,本地文件会 canonicalize 并校验为文件,外链限定 `http://` / `https://`。
  - `open_document(id, document_id)`: 使用系统默认程序打开本地文件或外链。
  - `delete_document(id, document_id)`: 删除项目资料关联。
- 新增 Rust 单元测试:
  - 外链资料校验和标题自动生成。
  - 本地文件资料 canonicalize、标题修剪和文件校验。
- 更新 `src-tauri/src/lib.rs`,注册 T9 的 4 个 Tauri 命令。
- 更新 `src/lib/projects-api.ts` 与 `src/lib/types.ts`,增加资料列表、添加、打开、删除的 invoke 封装和前端文档字段。
- 更新 `src/features/ProjectDetail.tsx`:
  - 资料 Tab 在 Tauri runtime 中读取真实 `documents` 表。
  - 支持添加外链/本地文件、展示列表、点击打开、删除。
  - 浏览器预览保留 mock 添加/删除,便于设计交互验证。
- 验证:
  - `cargo test` in `src-tauri` 通过,20 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证资料 Tab 添加外链、列表展示、点击打开反馈、删除后消失,应用 console errors 为空。

## 2026-06-06 — T8 DeepSeek 接入与 AI 档案初稿

- 新增 `src-tauri/src/ai.rs`:
  - `get_deepseek_key_status`: 返回 Key 是否已配置及 masked 展示值,不返回明文 Key。
  - `save_deepseek_api_key`: 将 Key 写入 SQLite `settings.deepseek_api_key`,留空可清空。
  - `generate_archive_ai(id)`: 收集项目文件树与关键文件内容,按固定 system prompt 调用 DeepSeek `deepseek-chat`,并把 Markdown 响应解析成四分区草稿。
- 新增 Rust 单元测试:
  - Key mask 不泄露完整 Key。
  - 可解析带编号的四分区 Markdown。
  - 上下文收集会包含 README/入口文件并跳过 `node_modules`。
- 更新 `src-tauri/src/lib.rs`,注册 T8 的 3 个 Tauri 命令。
- 更新 `src-tauri/Cargo.toml`,新增 `reqwest` 作为 Rust 侧 DeepSeek HTTP 客户端。
- 更新 `src/lib/projects-api.ts`,封装 Key 状态、保存 Key、生成 AI 档案草稿的 invoke。
- 更新 `src/features/Settings.tsx`:
  - DeepSeek Key 区块去掉 mock 明文值。
  - 支持输入、显示/隐藏、保存/清空,并展示当前 masked 状态。
- 更新 `src/features/Drawers.tsx` 与 `src/App.tsx`:
  - AI 抽屉在 Tauri runtime 中调用 `generate_archive_ai`。
  - 浏览器预览保留 mock 打字效果,并修复满段后不推进下一段的问题。
  - 生成完成后四段草稿可编辑校对；保存全部一次性写入项目档案。
- 验证:
  - `cargo test` in `src-tauri` 通过,18 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证设置页 Key UI、AI 抽屉生成完成态、4 个可编辑 textarea、保存全部后档案更新,应用 console errors 为空。

## 2026-06-06 — T7 项目档案与强制留痕

- 新增 `src-tauri/src/archive.rs`:
  - `read_archive(id)`: 读取 `<project>/.memoir/archive.md`,解析「项目定位 / 技术栈与设计 / 运行部署运维 / 待办与已知问题」四个分区。
  - `save_archive(id, sections)`: 写入 `<project>/.memoir/archive.md`,并同步 `archives.sections_state` 与 `projects.archive_completeness`。
  - 完整度按四段填充数计算,结果为 0/25/50/75/100。
- 更新 `src-tauri/src/lib.rs`,注册 `read_archive`、`save_archive` 两个 Tauri 命令。
- 更新 `src/lib/projects-api.ts`,新增档案 read/save invoke 封装,并映射后端 `archive_completeness`。
- 更新 `src/store/useMemoirStore.ts` 与 `src/App.tsx`:
  - 进入项目详情时读取真实档案。
  - 保存分区时先乐观更新 UI,再调用后端写盘并回填后端完整度。
- 更新 `src/lib/completeness.ts`,总览和详情完整度环改为只反映四段档案完整度。
- 更新 `src/features/ProjectDetail.tsx`,Archive 卡片在真实档案异步加载后同步编辑草稿。
- 验证:
  - `cargo test` in `src-tauri` 通过,15 个单元测试全绿,包含 `.memoir/archive.md` 实际写入测试。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证 Archive Tab 编辑保存后完整度从 75% 变 100%,console errors 为空。

## 2026-06-06 — T6 Git 写操作与 Diff

- 扩展 `src-tauri/src/git.rs`:
  - `git_init(path)`: 初始化项目目录为 Git 仓库,并更新 `projects.vcs_type`。
  - `git_set_remote(id, url)`: 新增或更新 `origin` 远程地址,并同步 `projects.remote_url`。
  - `git_commit(id, message, files)`: 对选中文件执行 `git add -- <file>` 后 commit,提交后更新 `projects.last_commit_at`。
  - `git_push(id)` / `git_pull(id)`: 执行系统 git push / `git pull --ff-only`,失败时返回原始 git stderr/stdout。
  - `git_diff(id, file?, commit?)`: 支持工作区 diff 和 commit diff,返回结构化文件、增删行统计和行级内容。
- Git 命令继续使用系统 `git`,并对文件相对路径和 revision 参数做安全校验。
- 更新 `src-tauri/src/lib.rs`,注册 T6 的 6 个新 Tauri 命令。
- 更新 `src/lib/projects-api.ts`,新增 init、set remote、commit、push、pull、diff 的 invoke 封装。
- 更新 `src/features/ProjectDetail.tsx`:
  - 非 Git 项目可输入远程地址并一键初始化。
  - Git Tab 可保存远程、Pull、Push、打开 Commit 弹窗。
  - Commit 弹窗支持填写提交信息并勾选要提交的文件。
  - 工作区文件列表可点击打开单文件 diff。
- 更新 `src/features/Drawers.tsx`,Diff 抽屉在 Tauri runtime 中读取真实 `git_diff`,浏览器预览继续使用 mock diff。
- 验证:
  - `cargo test` in `src-tauri` 通过,11 个单元测试全绿,包含真实临时 Git 仓库 commit/diff 测试。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证 Git 面板、Commit 弹窗、文件 Diff 抽屉,console errors 为空。

## 2026-06-06 — T5 Git 读取真实数据

- 新增 `src-tauri/src/git.rs`:
  - `git_status(id)`: 在项目目录执行系统 `git`,读取当前分支、远程、ahead/behind、dirty 状态和变更数。
  - `git_status(id)` 会 upsert `git_cache`,并同步更新 `projects.vcs_type`、`projects.remote_url`、`projects.last_commit_at`。
  - `git_log(id, limit)`: 读取最近提交,解析 hash、完整 hash、提交信息、作者、日期和 `--numstat` 增删行。
  - 非 Git 项目返回 untracked 状态并清理对应 `git_cache`。
- 更新 `src-tauri/src/lib.rs`,注册 `git_status`、`git_log` 两个 Tauri 命令。
- 更新 `src/lib/projects-api.ts`,新增 Git 状态和提交历史 invoke 封装,映射到现有 `GitInfo` / `CommitInfo`。
- 更新 `src/features/ProjectDetail.tsx`:
  - Git Tab 在 Tauri runtime 中自动读取真实 Git 状态和最近 20 条提交。
  - 顶部展示分支、远程、ahead/behind、dirty 状态。
  - 非 Git 项目继续显示 T6 初始化引导。
- 验证:
  - `cargo test` in `src-tauri` 通过,9 个单元测试全绿,包含临时真实 Git 仓库的 status/log 测试。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证进入详情 Git Tab,console errors 为空。

## 2026-06-06 — T4 项目详情与真实文件树

- 新增 `src-tauri/src/file_tree.rs`:
  - `get_file_tree(id, depth?)`: 按项目 ID 读取根目录文件树,目录优先排序,跳过 `.git`、`node_modules`、`target`、`dist` 等重目录。
  - `read_project_file(id, path)`: 只允许读取项目目录内的相对路径,对二进制、非 UTF-8、超过 512 KB 的文件返回占位提示。
  - 新增路径安全、二进制识别、相对路径格式化单元测试。
- 更新 `src-tauri/src/projects.rs`,新增 `get_project(id)` 并复用项目记录查询。
- 更新 `src/lib/projects-api.ts`,封装 `get_project`、`get_file_tree`、`read_project_file` 的前端调用。
- 更新 `src/features/ProjectDetail.tsx`:
  - 文件 Tab 在 Tauri runtime 中加载真实文件树。
  - 选择文件后读取真实文本内容,右侧使用 mono 只读预览。
  - 浏览器预览仍保留 mock 文件树和 mock code preview。
- 验证:
  - `cargo test` in `src-tauri` 通过,5 个单元测试全绿。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Browser 本地预览验证点卡进入详情、文件 Tab、文件选择、目录折叠,console errors 为空。

## 2026-06-06 — T3 项目发现与总览真实数据

- 新增 `src-tauri/src/projects.rs`:
  - `scan_projects(roots)`: 递归识别含 `.git` 的目录,跳过 `node_modules`、`target`、`dist` 等大目录,写入 SQLite。
  - `add_project(path)`: 手动添加普通文件夹或 Git 项目。
  - `list_projects(filter, sort)`: 支持状态/搜索过滤和最近打开、最近提交、完整度、名称排序。
- 项目路径入库前统一 canonicalize,依赖 `projects.path UNIQUE` 防重复。
- 扫描根目录写入 `settings.scan_roots`。
- 新增 `src/lib/projects-api.ts`,将后端项目记录映射为前端 `Project` 模型。
- 更新 Zustand store,总览项目列表由 store 管理；Tauri runtime 使用 SQLite 数据,浏览器预览继续使用 mock。
- 更新添加项目弹窗:
  - 扫描目录会调用真实 `scan_projects`。
  - 可直接「添加为普通项目」调用 `add_project`。
- 验证:
  - `cargo test` in `src-tauri` 通过,包含语言识别和跳过大目录单元测试。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。
  - Playwright/Chrome 浏览器预览 console errors 为空。

## 2026-06-06 — T2 SQLite schema 与迁移

- 新增 `src-tauri/src/db/schema.sql`,创建 8 张 MVP/二期所需表:
  - `projects`
  - `archives`
  - `documents`
  - `git_cache`
  - `tags`
  - `project_tags`
  - `settings`
  - `chat_links`
- 新增 `src-tauri/src/db/mod.rs`,通过 `tauri-plugin-sql` 注册 version 1 migration。
- 更新 `src-tauri/tauri.conf.json`,添加 `plugins.sql.preload = ["sqlite:memoir.db"]`,启动时自动建库并执行迁移。
- 新增 `src-tauri/capabilities/default.json`,授予 `sql:default` 权限。
- 新增 `src/lib/database.ts`,前端启动时调用 `Database.load("sqlite:memoir.db")`,并在设置页状态中显示数据库初始化结果。
- 验证:
  - `schema.sql` 在内存 SQLite 连续执行两次通过,确认幂等。
  - `cargo check` in `src-tauri` 通过。
  - `PATH=/usr/local/bin:$PATH /usr/local/bin/npm run build` 通过。

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
