// 站点核心配置 — 站点名称、导航、SEO 信息
// 被谁引用：core/SeoMeta.astro 与各主题布局/页面用这里的值生成标题、SEO 和主导航。
// 改 categoryLabel 改分类中文名（要与 content.config.ts 里的 category 枚举保持一致）。
export const site = {
	name: "Lumen Kael Xystus",
	title: "Lumen Kael Xystus", // 默认页面标题
	description: "二次元审美与技术开发记录的个人博客。", // 站点描述（用于 SEO）
	author: "Lumen Kael Xystus / Lunkey", // 作者名称
	keywords: [
		"lunkey",
		"Lumen Kael Xystus",
		"个人博客",
		"二次元",
		"技术开发",
		"Astro",
	],
	// 主导航菜单配置
	nav: [
		{ href: "/",
      label: "HOME",
      icon: "tabler:home-heart",
      hint: "front page"
    },
		{ href: "/blog/",
      label: "BLOG",
      icon: "tabler:book-2",
      hint: "notes"
    },
		{
			href: "/projects/",
			label: "WORKS",
			icon: "tabler:code",
			hint: "projects",
		},
		{
			href: "/about/",
			label: "ME",
			icon: "tabler:user-heart",
			hint: "profile",
		},
	],
};

// 文章分类标签映射（用于显示中文分类名）
export const categoryLabel: Record<string, string> = {
	tech: "技术开发",
	anime: "二次元",
	life: "日常记录",
};
