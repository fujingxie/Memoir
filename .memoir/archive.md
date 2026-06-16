## 项目定位

Memoir 是一个桌面端项目管理与知识归档工具，用于帮助开发者记录和管理项目档案。它解决了以下问题：

- **项目档案缺失**：开发者经常忘记记录项目的关键信息（技术栈、设计决策、TODO等）
- **项目散落各处**：多项目缺乏统一管理入口，难以追踪项目状态
- **归档自动化不足**：缺乏自动化的项目信息收集和档案生成工具

核心功能包括项目扫描与分类、档案编辑（手动+AI辅助）、Git状态追踪、项目完整度评估、项目文档/文件夹资料关联、以及 Claude / ChatGPT / Claude Code / Codex 聊天关联管理。

## 技术栈与设计

- **前端**: React 18 + TypeScript, TailwindCSS, Zustand（状态管理）, Vite 6
- **桌面框架**: Tauri 2.0（Rust后端）
- **数据库**: Tauri SQL 插件（SQLite, 通过 Rust 的 schema.sql 管理）
- **AI 集成**: DeepSeek API（用于自动生成项目档案）
- **包管理**: npm scripts


1. **双模式运行**：支持 Tauri 桌面端（完整功能）和浏览器预览模式（mock数据），通过 `isTauriRuntime()` 判断
2. **档案持久化**：项目档案通过 Rust 后端写入 SQLite 数据库，同时前端 store 缓存；浏览器模式则使用 localStorage
3. **项目完整度计算**：在 `src/lib/completeness.ts` 中实现，可能基于档案字段填充度、Git 状态等指标
4. **模块化架构**：功能按 features 划分（Overview、ProjectDetail、Settings、Drawers），UI 组件与业务逻辑分离
5. **TypeScript 严格模式**：`tsconfig.json` 中启用了 `strict: true`
6. **资料关联**：`documents` 表支持外链、本地文件和本地文件夹；本地文件/文件夹通过 Tauri 命令调用系统选择器。
7. **概览数据**：项目列表/详情的技术栈和最近活动由 Rust 侧即时读取项目标志文件、档案文本和 Git 最新提交生成。

## 运行部署运维

```bash
npm run tauri -- dev
npm run build
npm run tauri -- build --bundles app
```

- **端口**：开发服务器固定使用 1420 端口
- **环境变量**：前缀为 `VITE_` 或 `TAURI_`
- **数据库**：SQLite 数据库由 Rust 后端初始化，schema 文件在 `src-tauri/src/db/schema.sql`，兼容迁移由 `src-tauri/src/projects.rs` 幂等执行
- **配置文件**：Tauri 配置在 `src-tauri/tauri.conf.json`
- **图标资源**：macOS bundle 图标来自 `src-tauri/icons/icon.icns` 及配套 PNG 尺寸
- **日志**：前端使用 `console.log` 加 `[DEBUG]` 前缀标识

## 待办与已知问题

- 查看 `STATUS.md` 和 `CHANGELOG.md` 了解最新开发进度和变更日志
- `coding-agent-instructions.md` 可能包含针对 AI 代理的开发指令
- `DESIGN.md` 应包含完整的设计文档（UI/架构设计）
- `.memoir/archive.md` 可能是项目自身的档案文件，需检查其内容

- 浏览器模式下部分功能不可用（Tauri 原生 API 依赖）
- 没有显式的错误边界组件，可能在生产环境出现白屏
- Cargo.lock 已提交，说明依赖版本已锁定
