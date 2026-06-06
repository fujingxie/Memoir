# Memoir — Coding Agent 实施指令

> 本文件可直接交给 AI coding agent。所有技术决策已锁定,**无需再做任何产品决策**。请严格按任务序列推进,每个任务完成后对照「验收标准」自检。

---

## 0. 项目目标(背景,不可更改)

Memoir 是一个**单用户、纯本地的桌面应用**,用于统筹开发者本机上的所有代码项目。核心价值:翻出久远项目时能快速看懂(项目记忆/留痕),并统一管理其结构、Git 记录、关联文档。无账号体系、无云端、无后端服务,数据全部存本地。

---

## 1. 技术栈(已锁定,禁止替换)

| 层 | 选型 | 版本/说明 |
|---|---|---|
| 桌面框架 | Tauri | 2.x |
| 前端 | React + TypeScript + Vite | React 18 |
| UI | Tailwind CSS + shadcn/ui | 深色为默认主题 |
| 状态 | Zustand | — |
| 本地存储 | SQLite | 经 `tauri-plugin-sql` |
| Git | 系统 `git` 命令 | Rust `std::process::Command` 调用,不引入 libgit2 |
| 档案正文 | 项目目录内 `.memoir/archive.md` | 不入库;DB 只存索引/完整度 |
| 大模型 | DeepSeek `deepseek-chat` | OpenAI 兼容接口,请求由 Rust 侧转发 |
| Markdown 渲染 | react-markdown | 档案预览 |
| 打包 | Tauri bundler | dmg / msi / AppImage |

---

## 2. 全局约定

- **语言**:界面文案中文;代码注释/标识符英文。
- **API Key 安全**:DeepSeek Key 存于 `settings` 表(或 OS keychain),**所有 DeepSeek 请求必须由 Rust 侧 Tauri 命令转发**,前端永不持有 Key、永不直接请求外网。
- **DeepSeek 调用规格**:
  - Endpoint:`POST https://api.deepseek.com/chat/completions`
  - Header:`Authorization: Bearer <key>`,`Content-Type: application/json`
  - Body:`{ "model": "deepseek-chat", "messages": [...] }`
  - 档案生成 system prompt(固定):`你是代码考古专家。根据给定的项目文件结构和关键文件内容,生成简洁、面向"几年后重新接手"的项目档案,分四部分:1) 项目定位(是什么/解决什么问题);2) 技术栈与关键设计决策;3) 如何运行/部署/运维;4) 待办与已知问题。用 Markdown,每部分用二级标题。`
  - 输入裁剪:文件树 + 关键文件内容(README、package.json/Cargo.toml/requirements.txt/go.mod、主入口文件),总输入裁剪到约 12k token 以内。
- **Git 调用**:全部在项目目录下执行,捕获 stdout/stderr 并原样返回错误信息;不吞错。
- **错误处理**:每个 Tauri 命令返回 `Result`,前端统一以 Toast 呈现错误。
- **档案文件**:写入 `<project>/.memoir/archive.md`;若目录不存在则创建;`archives.sections_state` 仅记录四个分区是否已填写。

---

## 3. 数据模型(SQLite)

```
projects(id, name, path UNIQUE, vcs_type[git|none], remote_url, last_commit_at,
         last_opened_at, archive_completeness INT 0-100, status[active|archived], created_at)
archives(id, project_id FK, md_path, sections_state JSON, updated_at)        -- 1:1
documents(id, project_id FK, type[local_file|link], title, path_or_url, created_at)  -- N:1
git_cache(project_id FK, branch, ahead INT, behind INT, dirty BOOL, fetched_at)      -- 1:1
tags(id, name);  project_tags(project_id, tag_id)                            -- N:N
settings(key, value)   -- scan_roots / deepseek_api_key / theme / editor_cmd
chat_links(id, project_id FK, source[claude|chatgpt], kind[link|import], url_or_file, title, summary, captured_at)  -- v2
```

---

## 4. 任务序列(按依赖排序,标注优先级与验收标准)

> 优先级:**P0** = MVP 必做、构成核心闭环;**P1** = MVP 重要、紧随其后;**P2** = 二期。
> 每个任务粒度≈一次提交,严格按编号顺序;括号内为前置依赖。

### T1 — 脚手架 【P0】(无依赖)
搭建 Tauri 2 + React/TS/Vite,集成 Tailwind、shadcn/ui、Zustand、`tauri-plugin-sql`。建立 §[目录结构]。
**验收**:`pnpm tauri dev` 能启动空窗口;Tailwind 类生效;能在 Rust 侧调用一个返回字符串的示例命令并在前端显示。

### T2 — 数据库 schema 与迁移 【P0】(依赖 T1)
按 §3 建表,写迁移脚本,首次启动自动建库。
**验收**:首次启动生成 SQLite 文件并含全部表;重复启动不报错、不重复建表。

### T3 — 项目发现与总览 【P0】(依赖 T2)
命令 `scan_projects(roots)`(递归识别含 `.git` 的目录,也允许标记普通文件夹)、`add_project(path)`、`list_projects(filter?, sort?)`。前端实现总览页:卡片网格、添加项目入口、按最近打开/最近提交/完整度/名称排序。
**验收**:指定一个根目录扫描后,所有含 `.git` 的子项目出现在列表;手动添加无 git 的文件夹成功;路径重复不会重复入库;排序切换生效;无项目时显示空态引导。

### T4 — 项目详情 + 文件树 【P0】(依赖 T3)
命令 `get_project(id)`、`get_file_tree(id, depth?)`。详情页含项目头 + Tab 框架(概览/文件/Git/档案/资料);文件 Tab 左树右只读预览。
**验收**:点卡片进入详情;文件树可展开;选中文件右侧显示其文本内容(mono 字体);二进制/超大文件给出占位提示而非崩溃。

### T5 — Git 读取 【P0】(依赖 T4)
命令 `git_status(id)`、`git_log(id, limit)`,结果写入 `git_cache`。Git Tab 上方显示分支/远程/ahead-behind/dirty,下方显示提交历史。
**验收**:对真实仓库正确显示当前分支、是否有未提交改动、最近 N 条提交(hash/信息/作者/日期);非 git 项目此 Tab 显示 init 引导占位(具体 init 在 T6)。

### T6 — Git 写操作 【P1】(依赖 T5)
命令 `git_init(path)`、`git_set_remote(id, url)`、`git_commit(id, message, files)`、`git_push(id)`、`git_pull(id)`、`git_diff(id, file?)`。UI:非 git 项目可一键 init 并填远程;commit 弹窗;push/pull 按钮;点提交或文件打开 diff 抽屉。
**验收**:对无 git 项目执行 init 后其 `vcs_type` 变为 git 且 Git Tab 正常;能成功 commit 并在历史中看到新提交;push/pull 的成功与失败都有明确反馈;diff 抽屉正确显示增删行。

### T7 — 项目档案 + 强制留痕 【P0】(依赖 T4)
命令 `read_archive(id)`、`save_archive(id, sections)`(写 `.memoir/archive.md`)。档案 Tab 四分区(定位/技术栈与设计/运行部署运维/待办与已知问题)可编辑;计算并存储 `archive_completeness`;总览卡片显示完整度环,低值标 warning 色。
**验收**:编辑并保存后,项目目录出现 `.memoir/archive.md` 且内容正确;完整度随已填分区数变化;重开应用档案内容仍在;卡片完整度环与实际一致。

### T8 — DeepSeek 接入(AI 生成档案初稿) 【P0】(依赖 T7)
设置页可填存 DeepSeek API Key。命令 `generate_archive_ai(id)`:Rust 侧收集文件树+关键文件→按 §2 规格调用 DeepSeek→返回四分区草稿。档案 Tab 顶部「AI 生成初稿」按钮,结果进预览抽屉供校对后保存。
**验收**:配置 Key 后点击生成,几秒内返回可读的四分区草稿;Key 未配置时给出明确提示;草稿可编辑后保存为 `.md`;前端代码中不出现明文 Key,网络请求仅发生在 Rust 侧。

### T9 — 文档关联 【P0】(依赖 T4)
命令 `add_document`、`list_documents`。资料 Tab 支持添加本地文件路径或外链,列表展示,可点击打开。
**验收**:本地文件与外链均能添加并持久化;点击本地文件用系统默认程序打开、外链用浏览器打开;删除生效。

### T10 — 打磨与打包 【P1】(依赖 T3–T9)
全局搜索、标签筛选;补全所有空态/加载 Skeleton/错误态;设置页(扫描目录增删、默认编辑器、主题切换、关于);Tauri 打包出三平台安装包。
**验收**:搜索能按名称/路径过滤;每个列表/Tab 都有空态与加载态;明暗主题切换即时生效;能产出至少当前平台的可安装包并正常启动。

### T11 — 聊天记录关联 【P2】(依赖 T9)
命令 `import_chat_export(file)`:解析 Claude/ChatGPT 导出的 JSON 或 Markdown;支持粘贴分享链接;关联到项目并存 `chat_links`,可由 DeepSeek 生成一句话 summary。
**验收**:导入官方导出文件后能列出其中对话并关联到指定项目;分享链接可保存并打开;关联项在项目详情可见。

---

## 5. 目录结构(建议)

```
memoir/
├── src/                      # React 前端
│   ├── routes/               # dashboard / project-detail / settings
│   ├── components/ui/        # shadcn 基础组件
│   ├── features/             # project · git · archive · ai · docs
│   ├── lib/                  # invoke 封装、工具
│   ├── store/                # zustand
│   └── styles/tokens.css     # Design Tokens(见设计简报)
├── src-tauri/src/
│   ├── commands/             # scan.rs git.rs archive.rs ai.rs docs.rs
│   ├── db/                   # schema + migrations
│   ├── git.rs  ai.rs  main.rs
├── package.json
└── tauri.conf.json
```

---

## 6. MVP 完成定义(Definition of Done)

完成 **T1–T5、T7–T9**(全部 P0)即构成可日常使用的 MVP:能扫描导入所有项目、进详情看结构与 Git 状态、为项目写/AI 生成档案留痕、关联文档。T6、T10 为紧随其后的 P1,T11 为 P2。
