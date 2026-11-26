/**
 * 作品（WORKS）页的数据源：技术线、作品条目、页首统计。
 * 集中管理 /projects/ 页面要展示的内容。
 * 被引用：themes/lumen-kael-xystus/pages/ProjectsPage.astro
 *line 要与 projectTechLines 的 key 对应；
 */
// 技术线分类：用于把作品按方向分组/筛选。key 会被 projectEntries.line 引用；
export const projectTechLines = [
  { key: "blog", label: "Blog / Astro", note: "主题、页面的小机关与交互实验" },
  { key: "web", label: "Web / Mobile", note: "浏览器里的远程入口与视觉页面" },
] as const;

// 作品列表：一条对应一个可展开的作品卡片。字段含义——id 唯一标识；line 对应上面的分类 key；
// status/year/stars/type 是展示用文本或数字；
// summary/role/details/note 是正文内容。

export const projectEntries = [
  {
    id: "Lumen-Kael-Xystus",
    title: "Lumen Kael Xystus 多主题博客",
    type: "Astro / Blog",
    line: "blog",
    status: "持续维护",
    year: "2026",
    repo: "Lumen-Kael-Xystus.github",
    href: "https://github.com/Lun-key/Lumen-Kael-Xystus.io",
    language: "Astro",
    stars: 0,
    summary: "把同一个人的三种气质拆成三套主题：FCLC的物语风格(未开发完成)、しろはの手帐日常，以及还未开发的rain98雨夜风格。",
    role: "设计、前端实现、内容与部署都希望由自己完成。",
    details: ["Astro 多主题路由", "WebGL / Canvas 动效(目前有考虑)", "静态站点与搜索"],
    note: "同一套内容，在三套主题里保留不同的阅读节奏：角色与故事、手帐与日常，以及更安静的文字记录。"
  },
  {
    id: "vitrual-world",
    title: "虚拟世界",
    type: "Web",
    line: "Web",
    status: "持续开发迭代",
    year: "2026",
    repo: "vitrual-world",
    href: "https://github.com/lun-key/vitrual-world",
    language: "SpringBoot + Vue + MySQL + Redis + WebSocket + Nginx + Docker + GitHub Actions +....后期迭代会变化 ",
    stars: 0,
    summary: "集成各种功能的二次元动漫论坛 / 社区 / 个人空间 / 角色扮演 / ai定制自己的追番助手 / 养一个虚拟老婆 / 让自己在虚拟世界里有一个小房间 / 社交 / 云galgame游戏 / 番剧观看 / 二次元虚拟世界",
    role: "目前ai对二次元的理解还不够深入，很多功能还在开发中，后续会持续迭代。",
    details: ["微服务分布式架构", "前后端分离", "多种功能集成"],
    note: "虚拟世界是一个集成了多种功能的二次元动漫论坛 / 社区 / 个人空间 / 角色扮演 / ai定制自己的追番助手 / 养一个虚拟老婆 / 让自己在虚拟世界里有一个小房间 / 社交 / 云galgame游戏 / 番剧观看 / 二次元虚拟世界。"
  }
] as const;

// 页首统计数字：纯展示，想换文案或数字直接改这里。
export const projectStats = [
  { label: "public repos", value: "03" },
  { label: "main themes", value: "03" },
  { label: "focus", value: "web × agent" }
] as const;
