# Memoir Design System

## 1. Visual Theme & Atmosphere

Memoir 是本机开发者项目记忆库,界面气质是「安静、密集、可信赖的桌面工具」。默认深色主题,以 macOS 圆角窗口、左侧固定导航、毛玻璃顶栏和可扫描的信息卡片构成主要体验。动画为 L2 流畅交互:transform-only 入场、卡片 hover、右侧抽屉和 AI 流式输出。

## 2. Color Palette & Roles

所有颜色通过 CSS 变量定义在 `src/styles/tokens.css`:

```css
--primary: #6366f1;
--primary-hover: #818cf8;
--primary-active: #4f46e5;
--primary-soft: rgba(99, 102, 241, 0.14);
--accent: #2dd4bf;
--bg: #0e0f13;
--surface: #16181d;
--surface-elevated: #1e2128;
--border: #2a2e37;
--text-primary: #e6e8ec;
--text-secondary: #9ca3af;
--success: #22c55e;
--warning: #f59e0b;
--error: #ef4444;
```

浅色主题同样通过 `[data-theme="light"]` 覆盖,主题选择持久化到 `localStorage["memoir-theme"]`。

## 3. Typography Rules

UI 字体为 Inter;代码、路径、hash、数字徽标使用 JetBrains Mono;中文 fallback 为 PingFang SC / Microsoft YaHei。Dashboard 标题保持 20-24px,卡片标题 15-16px,正文 13.5-14px,辅助信息 11.5-12.5px。中文正文行高不低于 1.6。

## 4. Component Stylings

按钮高度 28/34px,圆角 8px,按下缩放 0.97。卡片使用 `surface` 背景、12px 圆角、`border` 边框;hover 上移 2px 并提升阴影。完整度环阈值为 `<40 error / <70 warning / >=70 success`。低完整度卡片左侧显示 3px error 竖条。抽屉宽度 `min(600px, 44vw)`,从右侧滑入。

## 5. Layout Principles

窗口尺寸为 `min(1440px, 100vw - 56px)` x `min(920px, 100vh - 56px)`。左侧栏 244px,顶栏 56px,内容区 padding 22-28px。项目网格为 `repeat(auto-fill, minmax(290px, 1fr))`,gap 16px。详情页固定项目头 + Tab 栏 + 滚动内容。

## 6. Depth & Elevation

深色阴影:sm `0 1px 2px rgba(0,0,0,.4)`,md `0 4px 12px rgba(0,0,0,.5)`,lg `0 12px 32px rgba(0,0,0,.6)`。浅色主题使用更轻阴影。模态/抽屉使用遮罩和 backdrop blur,保持桌面应用的层级感。

## 7. Animation & Interaction

Tab 内容使用 `riseIn` 位移入场。卡片 hover 上移,按钮按压缩放。Diff / AI 抽屉使用 `slideInRight`。AI 生成抽屉按分区逐字流式输出,当前分区显示 caret blink,完成分区显示「采纳」。所有入场动画以可见态为基础,动画只增强,不依赖 `opacity: 0` 隐藏内容。已实现 `prefers-reduced-motion` 降级。

## 8. Do's and Don'ts

- Do: 保持信息密度,优先面向扫描和重复使用。
- Do: 所有业务色彩使用 CSS 变量。
- Do: 代码路径、hash、数字使用 mono 字体。
- Do: 空态、低完整度、未提交改动必须有明确提示。
- Do: 抽屉和弹窗必须可用 Esc 或遮罩关闭。
- Don't: 使用营销页式 hero 或装饰性大卡片。
- Don't: 把关键操作藏在纯文案里。
- Don't: 使用紫色渐变铺满页面;primary 只做操作和状态强调。
- Don't: 用 opacity-only 入场导致内容在动画失败时不可见。

## 9. Responsive Behavior

桌面为主,移动端降级为窄侧栏,隐藏侧栏文案与标签区。网格、信息卡和文件 split-pane 在 860px 以下折叠为单列。抽屉宽度在小屏下占满可用宽度,按钮保持可点击尺寸。

