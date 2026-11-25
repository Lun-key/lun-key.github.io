# Lumen-Kael-Xystus

`Lumen-Kael-Xystus` 是 Lun-key 使用 Astro 构建的个人主题站点与数字手账。项目同时保留博客笔记、作品项目、个人资料、动画资源和互动组件，也提供多套主题外观切换。

仓库地址：`https://github.com/Lun-key/Lumen-Kael-Xystus`

线上站点：`https://lun-key.github.io`

## 项目定位

这个项目不是单一页面模板，而是一套可切换主题的个人内容站点。同一篇文章、作品数据和个人资料会通过共享路由与组件渲染成不同主题的页面，不同主题只负责视觉和排版表达。

主要内容包括：

- 技术笔记与博客文章。
- Web、AstrBot、Codex 和其他个人作品。
- 兴趣、番剧、游戏、社交资料和个人简介。
- 音乐播放器、Live2D 看板娘、樱花雨和漫画动效。
- 响应式封面、全文搜索和主题偏好记忆。

## 主题风格

项目在主题注册表中提供两套主题。

### Lumen Kael Xystus

默认主题，适合日常记录、技术笔记和个人展示。

视觉特点：

- 夏日晴空配色，主要使用蓝、白、粉和淡紫。
- 日记本、手账纸和漫画分格的页面结构。
- 分层漫画首屏，人物和背景可以产生视差效果。
- 终端风格个人名片和打字动画。
- 玻璃感导航、樱花雨、页脚计时器和小猪滚动条。
- 纵向漫画章节轨道、回忆相册和作品展开卡片。
- RUKI Live2D 看板娘、音频播放器和自定义右键菜单。

默认主题通过根路径访问：

```text
/
/blog/
/projects/
/about/
```

主题根路径保留为：

```text
/themes/lumen-kael-xystus/
```

### FLCL(还在开发中)

独立主题，使用物语系列风格的硬边视觉语言。

视觉特点：

- 黑、白、红为主的高对比配色。
- 矩形边框、硬阴影和极简拼贴排版。
- 明确的章节标识、编排分区和粗重视觉边界。
- 与默认主题共用站点内容数据，但使用独立首页组件和样式。

主题入口：

```text
/themes/flcl/
/themes/flcl/blog/
/themes/flcl/projects/
/themes/flcl/about/
```

## 页面与路由

根页面由默认主题负责渲染，主题系统会根据用户保存的偏好选择目标主题。

主要页面：

| 页面 | 根路径 | 主题路由示例 |
| --- | --- | --- |
| 首页 | `/` | `/themes/lumen-kael-xystus/` |
| 博客列表 | `/blog/` | `/themes/lumen-kael-xystus/blog/` |
| 博客文章 | `/blog/<slug>/` | `/themes/lumen-kael-xystus/blog/<slug>/` |
| 作品页 | `/projects/` | `/themes/lumen-kael-xystus/projects/` |
| 关于页 | `/about/` | `/themes/lumen-kael-xystus/about/` |
| FLCL 首页 | 无根路径别名 | `/themes/flcl/` |

主题偏好保存在浏览器的 `localStorage` 中。切换主题时，页面会尝试保留当前中性内容路径，例如从 `/blog/` 切换到 FLCL 时进入 `/themes/flcl/blog/`。

## 核心功能

### 博客与内容

- Markdown 或 MDX 博客文章位于 `src/content/blog/`。
- Expressive Code 提供代码高亮、复制按钮和终端框架。
- Pagefind 在构建后生成中文全文搜索索引。
- 博客封面支持响应式 `srcset`，减少移动端图片带宽。

### 多主题切换

主题注册位于 `src/core/themes/registry.ts`，包含主题 ID、展示名称、描述和路由前缀。

默认主题的根路由不增加主题前缀。FLCL 等其他主题使用独立主题前缀，页面切换时会先把带主题前缀的地址还原为中性内容路径，再拼接目标主题路径。

### Live2D

RUKI Live2D 模型位于：

```text
public/themes/lumen-kael-xystus/RUKI/live2d-psd2live/
```

模型包含：

- Cubism 3 模型文件。
- 4096 分辨率贴图。
- 物理、眨眼、点头、摇头和待机动作。
- 普通、微笑、半闭眼、惊讶、嫌弃眼和左右眨眼表情。

提示配置位于：

```text
public/themes/lumen-kael-xystus/RUKI/waifu-tips.json
```

看板娘支持：

- 鼠标和触摸视线跟随。
- 待机眨眼与随机表情。
- 点击角色触发表情和气泡对话。
- 拖动角色到其他位置。
- 隐藏、恢复、说句话和拍照等工具。
- 页面切换时清理动画监听。
- 减少动态效果偏好时关闭随机动作。

### 音乐播放器

音乐源文件位于 `MUSIC/`，发布副本位于：

```text
public/themes/lumen-kael-xystus/music/
```

播放器会读取 `manifest.json` 并提供：

- 上一首、下一首和播放暂停。
- 播放进度拖动。
- 音量调节。
- 进度、曲目和音量恢复。
- 页面切换后的播放状态保留。
- 可选的进站续播。

### 其他互动效果

- 樱花雨和随机飘落元素。
- 首页分层漫画与视差滚动。
- 章节轨道和作品漫画卡片。
- 今日公告弹窗。
- 页脚计时器。
- 页面底部滚动小猪。
- 自定义右键菜单。
- 代码块复制按钮。
- 桌面与移动端响应式布局。

## 技术栈

- Astro 7。
- 原生 TypeScript、JavaScript 和 CSS。
- Astro Content Collections。
- `@astrojs/markdown-remark`。
- Expressive Code。
- Pagefind。
- Astro Icon。
- Live2D Web Cubism SDK 与 live2d-widgets。
- Sharp 图片处理。

## 环境要求

- Node.js 24 或兼容版本。
- npm。
- 用于代码高亮、图像处理和页面构建的现代终端环境。

## 本地运行

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

本地地址：

```text
http://localhost:4321/
```

## 构建与预览

执行直接 Astro 构建：

```bash
npm exec astro -- build
```

执行完整资源与封面构建流程：

```bash
npm run build
```

构建产物默认位于 `dist/`。

预览构建产物：

```bash
npm run preview
```

## 测试

运行项目测试：

```bash
npm test
```

测试覆盖主题注册、封面选择、作品展开、Live2D 工具、博客页面和首页交互等模块。

## 主要目录

```text
src/pages/                     页面路由入口
src/themes/                    主题组件、页面、样式和主题工具
src/themes/lumen-kael-xystus/  默认的漫画手账主题
src/themes/flcl/               FLCL 风格主题
src/core/themes/               主题注册和主题偏好逻辑
src/core/content/              博客和封面内容工具
src/core/data/                 个人资料、导航和作品数据
src/content/blog/              博客 Markdown 内容
public/themes/                 主题图片、Live2D、音乐和静态资源
public/blog-covers/            博客封面源图和响应式封面
public/blog-assets/            博客文章配套资源
scripts/                       资源生成、封面处理和构建检查脚本
scripts/lib/                   可复用的资源选择和发布策略
tests/                         Node 测试与回归检查
```

## 资源约定

- 网站公开资源统一放在 `public/`。
- 默认主题资源放在 `public/themes/lumen-kael-xystus/`。
- Live2D 模型不要随意修改或重命名内部相对路径。
- 新增博客封面时，应通过项目封面生成脚本更新响应式清单。
- 新增音乐文件后，应同步更新发布目录和 `manifest.json`。
- 新主题应在 `src/core/themes/registry.ts` 注册后，再添加对应页面入口。

## 部署

项目输出静态文件，可部署到：

- GitHub Pages。
- EdgeOne Pages。
- Cloudflare Pages。
- Vercel。
- Netlify。
- 任意静态 HTTP 服务。

部署前先构建：

```bash
npm exec astro -- build
```

再将 `dist/` 部署到目标平台。

## 许可证与资源说明

代码、图片、字体、音乐、Live2D 模型和其他第三方资源可能使用不同许可证。公开部署或二次分发前，请逐项确认：

- 项目代码许可证。
- 动画、插画和人物资源许可。
- 字体和图标授权。
- 音乐和音频版权。
- Live2D 模型使用条款。
- 页面中涉及的作品、角色和 IP 署名要求。

项目中的许可证和资源清单文件应作为公开发布前的参考资料。
>**本项目要感谢大佬@Yuimi-chaya**

## 项目状态

当前站点已包含：

- Lumen Kael Xystus 默认主题。
- FLCL 独立主题(目前仍然在开发中)。
- 博客、作品和关于页面。
- RUKI Live2D 看板娘。
- 本地音乐播放清单。
- 响应式封面和 Pagefind 搜索。
