# Handoff: Memoir — 本机项目记忆库(开发者桌面应用)

## Overview
Memoir 是一个**单用户、纯本地的开发者桌面应用**,用于统筹本机所有代码项目:查看项目结构、Git 记录、关联文档,并为久远项目「留痕」(项目记忆),支持 AI 自动生成项目档案。本交付包是该产品的**高保真可交互原型**,覆盖:项目总览主页、项目详情(5 个 Tab)、设置页,以及 Diff 抽屉、AI 流式生成抽屉、添加项目弹窗等浮层。

## About the Design Files
本包内的文件是用 **HTML + React(浏览器内 Babel)** 制作的**设计参考稿** —— 它们演示了「最终该长什么样、怎么交互」,**不是可直接发布的生产代码**。

你的任务是:**在目标代码库的既有技术环境中,把这些 HTML 设计稿原样复刻出来**,使用该环境已有的组件库与工程约定。
- 产品定位本身是一个 **Electron + React + TypeScript** 桌面应用(见示例数据里的 `memoir` 项目),若从零开始,推荐就用 Electron + React + TS + Vite,元数据用 SQLite 缓存,AI 走 DeepSeek API。
- 若已有前端环境,请沿用其设计系统/组件库,只把本稿当作视觉与交互的「真值」。

## Fidelity
**高保真(hifi)。** 颜色、字体、间距、圆角、阴影、交互均为最终值,请像素级复刻。下方「Design Tokens」给出全部精确数值。

---

## Design Tokens

### 配色 — 深色主题(默认)
| 类别 | 名称 | 值 |
|---|---|---|
| 主色 | primary / hover / active | `#6366F1` / `#818CF8` / `#4F46E5` |
| 主色衬底 | primary-soft / primary-ring | `rgba(99,102,241,.14)` / `rgba(99,102,241,.35)` |
| 辅助色(Git/青) | accent / accent-soft | `#2DD4BF` / `rgba(45,212,191,.13)` |
| 背景 | bg / surface / surface-elevated / surface-hover | `#0E0F13` / `#16181D` / `#1E2128` / `#20242C` |
| 边框 | border / border-strong | `#2A2E37` / `#363B46` |
| 文字 | primary / secondary / tertiary | `#E6E8EC` / `#9CA3AF` / `#6B7280` |
| 语义 | success / warning / error / info | `#22C55E` / `#F59E0B` / `#EF4444` / `#3B82F6` |
| 语义衬底 | *-soft | 同色 `rgba(...,.14~.15)` |
| Diff | add 底 / del 底 | `rgba(34,197,94,.12)` / `rgba(239,68,68,.12)` |
| Diff | add 字 / del 字 | `#4ade80` / `#f87171` |

### 配色 — 浅色主题
| 类别 | 值 |
|---|---|
| primary / hover / active | `#4F46E5` / `#6366F1` / `#4338CA` |
| accent | `#0D9488` |
| bg / surface / surface-elevated / surface-hover | `#F5F6F8` / `#FFFFFF` / `#FFFFFF` / `#F0F2F5` |
| border / border-strong | `#E3E6EB` / `#D2D7DE` |
| 文字 primary / secondary / tertiary | `#1A1D23` / `#57606A` / `#8B95A1` |
| success / warning / error / info | `#16A34A` / `#D97706` / `#DC2626` / `#2563EB` |

主题通过 `<html data-theme="dark|light">` 切换;所有颜色用 CSS 变量。主题选择持久化到 `localStorage['memoir-theme']`。

### 字体
- UI 字体:**Inter**;代码/路径/hash:**JetBrains Mono**;中文 fallback:`PingFang SC / Microsoft YaHei`。
- 字号(px)/字重:H1 23/700 · H2 18/650 · H3 15-16/650 · 正文 13.5-14/400-500 · 辅助 11.5-12.5/400 · 代码 12.5-13/400。
- 行高:正文 1.5–1.65,标题 1.2–1.3。
- 数字(完整度、hash、+/- 行数、计数徽标)一律用 JetBrains Mono。

### 间距 / 圆角 / 阴影
- 间距基础单位 **8px**(含 4px 半档):4 / 8 / 12 / 16 / 24 / 32 / 48。组件内 padding 12–16,卡片间距 16,区块间距 20–32。
- 圆角:sm `6` · **md `8`(默认)** · 卡片 `10–12` · 标签/头像 `999`(full)。窗口外壳 `14`。
- 阴影:sm `0 1px 2px rgba(0,0,0,.4)` · md `0 4px 12px rgba(0,0,0,.5)`(悬浮) · lg `0 12px 32px rgba(0,0,0,.6)`(模态/抽屉)。浅色主题用更轻的阴影(见 styles.css)。

---

## Screens / Views

### 窗口外壳(macOS chrome)
整个应用置于一个圆角 14px 的 macOS 窗口内:左上角红/黄/绿交通灯(hover 显示 ×/–/+ 符号),桌面背景为深色径向渐变。窗口尺寸 `min(1440px, 100vw-56px) × min(920px, 100vh-56px)`,居中。生产桌面应用里由原生窗口提供,Web 演示用 CSS 模拟。

### 布局骨架
两栏:**左侧栏 244px**(`surface` 背景,右边框)+ **主区**(`bg` 背景,纵向 flex:56px 顶栏 + 可滚动内容)。

#### 左侧栏(常驻)
- 顶部 44px 交通灯行 → Memoir 字标(26px 渐变方块图标 `linear-gradient(135deg, primary, accent)` + 文字)。
- 导航项「项目库」(带计数徽标 10)。
- **筛选区(仅对总览生效)**:
  - **状态**:三段式按钮 全部 / 活跃 / 归档(选中态 primary-soft 底 + primary-ring 边 + primary 字)。
  - **排序**:列表 最近打开 / 最近提交 / 完整度 / 名称(选中项左侧图标变 primary,右侧 ✓)。
  - **标签**:全部标签的 chip 流式排列,可多选(选中态 primary-soft)。
- 底部:设置入口 + 主题切换图标按钮。

#### 顶栏(56px,毛玻璃 `backdrop-filter: blur(12px)`)
- **总览态**:左侧搜索框(36px 高,放大镜图标 + placeholder「搜索项目、路径、标签…」+ 右侧 ⌘K kbd)、右侧 网格/列表切换(2 段式)+ 主按钮「添加项目」(primary,加号图标)。
- **详情/设置态**:左侧「返回」ghost 按钮 + 面包屑「项目库 › <名称>」。

---

### ① 项目总览(主页)
- 内容区 padding `22px 28px`。先「已置顶」分区(SectionLabel + 网格),再「全部项目 · N」分区。
- **网格**:`grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px`。列表态改为纵向 flex,gap 8。
- **项目卡片**(`surface` 底,圆角 12,border `border`,padding 16):
  - 头行:语言色点(LangDot,带同色 22% 光环)+ 项目名(15.5/650)+ 置顶图钉;右上角**完整度环**(46px)。
  - 路径(JetBrains Mono,11.5,tertiary,省略号)。
  - 描述(2 行截断,secondary);**无描述时**显示红色提示「⚠ 还没有档案 — 用 AI 补一份留痕」。
  - 标签(最多 3 个 chip)。
  - 分隔线后底行:**GitBadge** + 时钟图标 + 最近提交时间;右侧默认显示**状态徽标**,hover 时**替换为**两个快捷图标(在访达打开 / 用编辑器打开)。
  - hover:上移 2px + md 阴影 + border 变 strong。
  - **完整度 < 40** 时:卡片左侧出现 3px 红色竖条 + 环数字变红 + 环呼吸动画 + 发光。
- **加载态**:6 张骨架卡(shimmer 动画)。**空态**:无项目→引导「添加扫描目录」;有筛选无结果→「清除筛选」。

### ② 项目详情(Tab 式)
- 顶部项目头(padding `20px 28px`):左 56px 完整度环 + 项目名(23/700)+ 语言点 + 状态徽标 + 路径·语言;右侧「编辑器」(secondary)+「打开目录」(primary)按钮。
- **Tab 栏**:概览 / 文件结构 / Git / 项目档案 / 资料。选中项底部 2px primary 下划线;**档案未填满时,档案 Tab 旁有橙色小圆点**提示。

**概览 Tab**:档案摘要面板(无档案→AI 生成 CTA 空态)+ 三张信息卡(技术栈 chips / 最近活动 commit / 完整度环 + 已填 X/4)+ 待补提醒条(橙色 accent,列出未填分区 chip,可点跳转,右侧「AI 补全」按钮)。

**文件结构 Tab**:左 300px 可展开**文件树**(文件夹 accent 色图标、可折叠;文件 mono 名)+ 右只读代码预览(行号 + mono,顶部文件名 + 「只读」标记)。

**Git Tab**:
- 顶部状态栏:当前分支 / 远程 / 状态(GitBadge)+ 右侧 Pull / Push / Commit 按钮(按 ahead/behind/dirty 显示数字)。
- 有未提交改动→橙色提示条(点击开 Diff 抽屉)。
- 提交历史列表(时间线圆点 + msg + hash·作者·时间 + 右侧 +add/−del),点 commit 行→**Diff 抽屉**。
- **非 Git 项目**:整个 Tab 换成 init 引导(图标 + 文案 + `git init && git add -A` 命令块 + 「初始化 Git 仓库」按钮)。

**项目档案 Tab**:四个分区(项目定位 / 技术栈与设计 / 运行部署运维 / 待办与已知问题),每区有「已填/待填」标注、可内联编辑(textarea + 保存/取消);顶部「重新 AI 生成」。**完全无档案时**显示模板空态(渐变卡 + 「AI 生成初稿」/「手动填写」+ 四分区模板预览)。

**资料 Tab**:本地文件 + 外链列表(图标 + 名 + 元信息 + 打开/外链图标)+「添加」按钮;空态引导。

### ③ 设置
单列(max 720),分组:扫描根目录(增删)、DeepSeek API Key(显示/隐藏 + 验证)、默认编辑器(VS Code / Cursor / WebStorm / Zed 段选)、主题(深/浅大卡预览选择)、关于(版本 + 更新日志)。

---

## Interactions & Behavior
- **导航**:点卡片→详情(默认概览 Tab);返回/面包屑→总览;设置入口→设置页。Tab 切换即时,内容区 `riseIn` 位移入场(0.26s)。
- **Diff 抽屉 / AI 抽屉**:从右侧滑入(`slideInRight`,40px 位移,0.26s),Esc 或点遮罩关闭。
- **AI 流式生成档案(招牌交互)**:打开后自动开始,四个分区**依次逐字流式输出**(每帧 ~16ms 揭示 2 字符),当前分区显示闪烁光标 + 标题脉冲点,未开始分区灰显;每区生成完出现「采纳」按钮(可单独采纳),全部完成后底部「全部采纳并保存 / 重新生成」。采纳后该分区写入档案、完整度联动上升、卡片转绿。
- **添加项目弹窗**:输入根目录→点「扫描」(spinner + 计数递增动画)→显示「N 个项目 / 扫描完成」→「导入 N 个项目」。
- **悬停反馈**:卡片上移、按钮按下缩放 0.97、列表项/树节点变底色。
- **Toast**:底部居中,success/warning/error/info 四色,2.6s 自动消失。
- **动画稳健性**:入场动画刻意使用**纯位移(不依赖 opacity 从 0)**,以保证即使动画未推进内容也始终可见;复刻时请保持「可见态为基础态、动画只是增强」的原则,避免 `opacity:0` 起始的入场把内容藏没。
- 尊重 `prefers-reduced-motion`(生产实现请补上)。

## State Management
- `theme`:'dark' | 'light',持久化 localStorage。
- `route`:'overview' | 'detail' | 'settings';`selectedId`;`tab`(详情内 Tab)。
- 筛选:`status` / `activeTags[]` / `sort` / `search` / `view`('grid'|'list')。派生出过滤+排序后的项目列表。
- `archives`:按项目 id 存四分区档案 `{positioning,tech,deploy,todos: {filled, text}}`,可编辑/可被 AI 采纳写入。
- **完整度统一由档案派生**(关键):`computeCompleteness(project, archive) = 已填分区数×20 + (有Git?8) + (有描述?6) + (有资料?4) + (有提交?2)`,封顶 100。卡片与详情共用同一函数 → 补档案后完整度实时上升。环颜色阈值:`<40 红 / <70 橙 / ≥70 绿`。
- 浮层开关:`diff{open,commit,mode}` / `aiOpen` / `addOpen`;`loading`(首屏骨架 ~900ms);`toast`。
- 数据获取(生产):扫描目录 → 读取每个仓库的 Git 元数据(simple-git)→ 缓存 SQLite;AI 档案走 DeepSeek 流式接口。

## Assets
- **无位图资源**。所有图标为内联 stroke 线性 SVG(16px 网格,见 `icons.jsx` 的 `ICON_PATHS`),复刻时可换成目标库(如 Lucide)的等价图标。
- 字标图标 = 圆角方块 + 渐变 + bookOpen 图标,纯 CSS/SVG。
- 字体来自 Google Fonts(Inter、JetBrains Mono)。

## Files(本包内)
- `Memoir.html` — 入口,按依赖顺序加载下列脚本。
- `styles.css` — 全部 design tokens(深/浅)、全局样式、keyframes。
- `icons.jsx` — 线性图标集 `Icon` + `ICON_PATHS`。
- `data.jsx` — 示例数据(10 个开发者项目 + 语言色 + 扫描目录)。
- `primitives.jsx` — Button / IconButton / LangDot / Tag / StatusBadge / **GitBadge** / **CompletenessRing** / **computeCompleteness** / EmptyState / Toast 等。
- `overview.jsx` — 项目卡片、网格、骨架/空态。
- `detail.jsx` — 详情壳 + Tab 导航 + 概览/文件结构/资料 Tab + 文件树 + 面板助手。
- `detail-git-archive.jsx` — Git Tab(含 init 引导)+ 项目档案 Tab(含编辑/空态)。
- `drawers.jsx` — Diff 抽屉 / **AI 流式生成抽屉** / Modal 壳 / 添加项目弹窗。
- `settings.jsx` — 设置页。
- `app.jsx` — 应用壳:窗口、侧栏、顶栏、路由、状态、主题、Toast 编排。

> 直接打开 `Memoir.html` 即可在浏览器交互查看;它是本说明的「真值」,文档与稿件不一致时以稿件为准。
