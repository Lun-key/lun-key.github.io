// FLCL Theme - 物语系列风格主题入口
// 首页使用 FLCL 自己的 HomePage；其他页面复用 Lumen Kael Xystus（lumen-kael-xystus）的内容组件

export { default as HomePage } from "./pages/HomePage.astro";

// 内容页复用 lumen-kael-xystus 组件，保持文章/作品/关于页一致体验
export { default as BlogIndexPage } from "@/themes/lumen-kael-xystus/pages/BlogIndexPage.astro";
export { default as ArticlePage } from "@/themes/lumen-kael-xystus/pages/ArticlePage.astro";
export { default as AboutPage } from "@/themes/lumen-kael-xystus/pages/AboutPage.astro";
export { default as ProjectsPage } from "@/themes/lumen-kael-xystus/pages/ProjectsPage.astro";
export { default as NotFoundPage } from "@/themes/lumen-kael-xystus/pages/NotFoundPage.astro";
