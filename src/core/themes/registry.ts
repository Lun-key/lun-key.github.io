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

// 工具函数：确保路径以 / 开头
function withLeadingSlash(pathname: string) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

// 获取路径的规范形式（去除主题前缀，还原为内容路径）
// 例如：/themes/flcl/blog/hello → /blog/hello
export function getCanonicalPath(pathname: string) {
  const normalized = withLeadingSlash(pathname);
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

// 将规范路径转换为指定主题的路径
// 例如：getThemePath("flcl", "/blog/hello") → /themes/flcl/blog/hello
export function getThemePath(themeId: ThemeId, pathname: string) {
  const canonicalPath = getCanonicalPath(pathname);
  const theme = getTheme(themeId);

  // 如果是默认主题，直接返回规范路径（不添加前缀）
  if (theme.id === DEFAULT_THEME_ID) return canonicalPath;
  // 如果主题没有路由前缀，返回规范路径
  if (!theme.routePrefix) return canonicalPath;
  // 如果是首页，返回主题首页路径
  if (canonicalPath === "/") return `${theme.routePrefix}/`;
  // 拼接主题前缀和规范路径
  return `${theme.routePrefix}${canonicalPath}`;
}
