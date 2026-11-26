// 主题系统 — 多主题切换、路由映射与主题注册
// localStorage 存储主题偏好的键名
export const THEME_STORAGE_KEY = "lumen-theme-id-v2";
// 默认主题 ID（站点根路径默认使用此主题）
export const DEFAULT_THEME_ID = "lumen-kael-xystus";

// 主题注册表 — 所有可用主题的配置
export const themes = [
  {
    id: "lumen-kael-xystus", // 主题唯一标识符
    label: "Lumen Kael Xystus", // 主题显示名称（用于右键菜单）
    description: "Lumen Kael Xystus — 夏日晴空手账主题",
    routePrefix: "/themes/lumen-kael-xystus" // 主题路由前缀（访问此路径即切换到该主题）
  },
  {
    id: "flcl",
    label: "FLCL",
    description: "物语系列风格 — FLCL / Fooly Cooly",
    routePrefix: "/themes/flcl"
  }
] as const;

// TypeScript 类型：所有主题 ID 的联合类型
export type ThemeId = (typeof themes)[number]["id"];

// 类型守卫：检查某个值是否为合法的主题 ID
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themes.some((theme) => theme.id === value);
}

// 根据主题 ID 获取主题配置对象，找不到时返回默认主题
export function getTheme(themeId: ThemeId) {
  return themes.find((theme) => theme.id === themeId)
    ?? themes.find((theme) => theme.id === DEFAULT_THEME_ID)
    ?? themes[0];
}

// Astro 的 base：GitHub Pages 项目站点部署在 /<仓库名>/ 子路径下时为 "/Lumen-Kael-Xystus.io"，本地为 "/"。
// routePrefix 始终保存不带 base 的规范值；对外输出 href 或匹配 location.pathname 时才处理 base。
const rawBase = import.meta.env.BASE_URL;
// basePrefix：不带尾部斜杠的 base，如 "" 或 "/Lumen-Kael-Xystus.io"。
const basePrefix = rawBase.replace(/\/$/, "");

// 工具函数：确保路径以 / 开头
function withLeadingSlash(pathname: string) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

// 剥离 base 前缀，得到不带 base 的规范路径（供下面的主题前缀匹配使用）。
// window.location.pathname / Astro.url.pathname 在子路径部署时都带 base。
function stripBase(pathname: string) {
  if (basePrefix && pathname === basePrefix) return "/";
  if (basePrefix && pathname.startsWith(`${basePrefix}/`)) {
    return pathname.slice(basePrefix.length) || "/";
  }
  return pathname;
}

// 给规范路径加上 base 前缀，输出可直接用于 href 的完整路径。
function withBase(pathname: string) {
  const normalized = withLeadingSlash(pathname);
  if (normalized === "/") return rawBase;
  return `${basePrefix}${normalized}`;
}

// 获取路径的规范形式（去除 base 和主题前缀，还原为内容路径）
// 例如：/Lumen-Kael-Xystus.io/themes/flcl/blog/hello → /blog/hello
export function getCanonicalPath(pathname: string) {
  const normalized = withLeadingSlash(stripBase(pathname));
  // 按前缀长度倒序排列（优先匹配最长前缀，避免冲突）
  const prefixedThemes = [...themes]
    .filter((theme) => theme.routePrefix)
    .sort((a, b) => b.routePrefix.length - a.routePrefix.length);

  for (const theme of prefixedThemes) {
    // 如果路径正好是主题首页，返回根路径
    if (normalized === theme.routePrefix || normalized === `${theme.routePrefix}/`) return "/";
    // 如果路径以主题前缀开头，去掉前缀返回规范路径
    if (normalized.startsWith(`${theme.routePrefix}/`)) {
      return normalized.slice(theme.routePrefix.length) || "/";
    }
  }

  return normalized;
}

// 将规范路径转换为指定主题的路径（含 base，可直接用于 href）
// 例如：getThemePath("flcl", "/blog/hello") → /Lumen-Kael-Xystus.io/themes/flcl/blog/hello
export function getThemePath(themeId: ThemeId, pathname: string) {
  const canonicalPath = getCanonicalPath(pathname);
  const theme = getTheme(themeId);

  // 如果是默认主题，直接返回带 base 的规范路径（不添加主题前缀）
  if (theme.id === DEFAULT_THEME_ID) return withBase(canonicalPath);
  // 如果主题没有路由前缀，返回带 base 的规范路径
  if (!theme.routePrefix) return withBase(canonicalPath);
  // 如果是首页，返回主题首页路径
  if (canonicalPath === "/") return withBase(`${theme.routePrefix}/`);
  // 拼接主题前缀和规范路径
  return withBase(`${theme.routePrefix}${canonicalPath}`);
}
