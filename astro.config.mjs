// Astro 框架核心配置
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
// 集成：代码高亮
import expressiveCode from "astro-expressive-code";
// 集成：生成 sitemap.xml
import sitemap from "@astrojs/sitemap";
// 集成：SVG 图标系统
import icon from "astro-icon";
// Markdown 插件：GitHub 风格表格、删除线等
import remarkGfm from "remark-gfm";
// HTML 插件：为标题自动生成 id
import rehypeSlug from "rehype-slug";
// HTML 插件：为标题添加锚点链接
import rehypeAutolinkHeadings from "rehype-autolink-headings";
// HTML 插件：代码高亮处理
import rehypeExpressiveCode from "rehype-expressive-code";
// Pagefind 全文搜索索引生成
import * as pagefind from "pagefind";
import { fileURLToPath } from "node:url";

// 代码块样式配置（用于 Expressive Code）
const expressiveCodeOptions = {
	themes: ["github-dark"], // 代码主题：GitHub 暗色
	defaultProps: {
		wrap: true, // 长代码自动换行
		overridesByLang: {
			// 为 Shell 脚本设置终端样式边框
			"bash,sh,zsh,powershell,ps1,bat,cmd": {
				frame: "terminal",
			},
		},
	},
	frames: {
		showCopyToClipboardButton: true, // 显示"复制代码"按钮
		removeCommentsWhenCopyingTerminalFrames: false, // 复制终端代码时保留注释
	},
	styleOverrides: {
		borderRadius: "8px", // 代码块圆角
		codeFontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace', // 代码字体
		codeFontSize: "0.9rem",
		codeLineHeight: "1.72",
		codePaddingBlock: "1.1rem", // 代码块上下内边距
		codePaddingInline: "1.25rem", // 代码块左右内边距
		codeBackground: "#111827", // 代码块背景色
		uiFontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
		frames: {
			frameBoxShadowCssValue: "0 18px 38px rgba(12, 18, 31, 0.28)", // 代码块阴影
			editorActiveTabBackground: "#111827",
			terminalTitlebarBackground: "#fdf5f0", // 终端标题栏背景
			terminalTitlebarForeground: "#546f9f", // 终端标题栏文字颜色
			inlineButtonBackground: "#f6d9d9", // 内联按钮背景
			inlineButtonForeground: "#3c6673",
			inlineButtonBorder: "#f7b7c8",
		},
	},
};

// 自定义 Pagefind 集成：构建后自动生成全文搜索索引
const pagefindIntegration = () => ({
	name: "Lunkey-pagefind",
	hooks: {
		// 构建完成后执行
		"astro:build:done": async ({ dir, logger }) => {
			// 创建 Pagefind 索引实例
			const { index, errors } = await pagefind.createIndex({
				forceLanguage: "zh", // 强制使用中文分词
				includeCharacters: "_-:", // 索引时包含这些特殊字符
			});

			if (!index) {
				logger.warn(`Pagefind index was not created: ${errors.join(", ")}`);
				return;
			}

			// 扫描构建输出目录下的所有 HTML 文件
			const distDir = fileURLToPath(dir);
			const addResult = await index.addDirectory({
				path: distDir,
				glob: "**/*.html",
			});

			if (addResult.errors.length) {
				logger.warn(
					`Pagefind indexing warnings: ${addResult.errors.join(", ")}`,
				);
			}

			// 将索引文件写入 /pagefind/ 目录
			const writeResult = await index.writeFiles({
				outputPath: fileURLToPath(new URL("./pagefind", dir)),
			});

			if (writeResult.errors.length) {
				logger.warn(
					`Pagefind write warnings: ${writeResult.errors.join(", ")}`,
				);
			} else {
				logger.info(`Pagefind indexed ${addResult.page_count} pages.`);
			}

			await pagefind.close();
		},
	},
});

export default defineConfig({
	site: "https://lun-key.github.io", // 站点 URL（用于生成 sitemap 和 RSS）
	output: "static", // 输出模式：静态站点生成（SSG）
	prefetch: {
		prefetchAll: false, // 不自动预加载所有链接
		defaultStrategy: "tap", // 点击链接时预加载
	},
	integrations: [
		expressiveCode(expressiveCodeOptions), // 代码高亮
		sitemap({
			// 生成 sitemap 时过滤掉 /themes/ 路径（主题路由不收录到搜索引擎）
			filter: (page) => !new URL(page).pathname.startsWith("/themes/"),
		}),
		icon({
			// 仅打包用到的图标（减少体积）
			include: {
				tabler: [
					"ai-agent",
					"brand-vue",
					"brand-css3",
					"brand-git",
					"brand-docker",
					"brand-astro",
					"home-heart",
					"book-2",
					"device-gamepad-2",
					"code",
					"user-heart",
					"search",
					"brand-github",
					"brand-bilibili",
					"sparkles",
					"heart",
					"device-gamepad",
					"movie",
					"pin",
					"terminal-2",
					"flower",
					"mood-smile",
					"chevron-down",
					"palette",
					"x",
					"arrow-up",
					"home",
					"archive",
					"arrow-left",
					"arrow-right",
					"link",
					"copy",
					"file-text",
					"player-play",
					"player-pause",
					"flask-2",
					"user-scan",
					"arrow-back-up",
					"activity-heartbeat",
					"refresh",
					"player-skip-forward",
					"arrow-down",
					"chevron-left",
					"chevron-right",
					"external-link",
					"blade",
					"blender",
					"chef-hat",
					"glass-full",
					"hand-finger",
					"hand-grab",
					"tools-kitchen-2",
					"trash",
				],
				"simple-icons": [
					"unity",
					"springboot",
					"godotengine",
					"openjdk",
					"blender",
					"unrealengine",
					"github",
					"bilibili",
					"steam",
					"thefinals",
				],
			},
		}),
		pagefindIntegration(), // 全文搜索索引生成
	],
	markdown: {
		syntaxHighlight: false, // 关闭默认语法高亮（使用 Expressive Code 代替）
		processor: unified({
			gfm: true, // 启用 GitHub 风格 Markdown
			remarkPlugins: [remarkGfm], // GFM 支持（表格、任务列表、删除线等）
			rehypePlugins: [
				rehypeSlug, // 为所有标题生成 id（如 ## 标题 → id="标题"）
				[
					rehypeAutolinkHeadings, // 为标题添加可点击的锚点链接
					{
						behavior: "append", // 将锚点链接添加到标题末尾
						properties: {
							className: ["heading-anchor"], // 锚点链接的 CSS 类名
							ariaLabel: "复制标题链接", // 无障碍标签
						},
						content: {
							type: "text",
							value: "#", // 锚点链接显示为 #
						},
					},
				],
				[rehypeExpressiveCode, expressiveCodeOptions], // 代码块增强处理
			],
		}),
	},
	devToolbar: {
		enabled: false, // 关闭开发工具栏（右下角的 Astro 调试面板）
	},
});
