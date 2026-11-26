/**
 * 主题“冬川加贺里（lumen-kael-xystus）”的入口文件。
 * 做什么：从主题注册表取出本主题配置并导出；同时把本主题的 6 个页面统一从此转发导出。
 * 被谁引用：主题注册表/路由按主题 id 找到这里，再用导出的 HomePage、ArticlePage 等渲染对应页面。
 * 改它会怎样：新增页面后要在这里加一行 export；getTheme 的 id 要与 registry.ts 中注册的主题 id 一致。
 * 教学：这是“桶文件（barrel）”——把同目录多个模块集中从一个文件导出，引用方就不用记每个文件的路径。
 */
import { getTheme } from "@/core/themes/registry";

// 从注册表拿到本主题的配置对象（id、label、routePrefix 等），传给框架使用。
export const lumenKaelXystusTheme = getTheme("lumen-kael-xystus");

// 下面是 6 个页面的统一导出：首页、博客列表、文章详情、关于、作品、404。想接一个新页面就照着加一行。
export { default as HomePage } from "./pages/HomePage.astro";
export { default as BlogIndexPage } from "./pages/BlogIndexPage.astro";
export { default as ArticlePage } from "./pages/ArticlePage.astro";
export { default as AboutPage } from "./pages/AboutPage.astro";
export { default as ProjectsPage } from "./pages/ProjectsPage.astro";
export { default as NotFoundPage } from "./pages/NotFoundPage.astro";
