/*
 * 构建产物审计脚本（lumenkaelxystus 主题）。
 *
 * 【使用场景】在生成 dist/ 构建之后手动运行，用来给最终产物做一次"体检"，
 *   提前发现坏链接、重复 id、缺失资源、被排除视频等回归问题。
 * 【读入】dist/themes/lumen-kael-xystus 目录下的所有 .html 文件（递归查找）。
 * 【检查内容】重复 id、aria-controls 指向的目标是否存在、漫画图片是否写了宽高、
 *   以 / 开头的本地资源（图片/样式表/脚本/站内链接）是否真实存在、内联脚本语法是否合法、
 *   首页与内页样式表是否正确分离、博客归档是否唯一、是否误引用了被排除的 mp4。
 * 【产出】向控制台打印统计 JSON；若有错误则逐条输出到 stderr 并让进程退出码为 1，
 *   全部通过则打印 "lumenkaelxystus production audit passed."。
 * 【运行命令】在项目根目录执行：node themes/lumen-kael-xystus/tools/audit-build.mjs
 *   （需先完成构建；脚本本身只读，不会修改 dist/ 里的文件。）
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { parse } from "parse5";

// dist 是构建输出根目录，root 是本主题在构建产物中的实际位置。
const dist = path.resolve("dist");
const root = path.join(dist, "themes/lumen-kael-xystus");
const files = (await fs.readdir(root, { recursive: true })).filter((file) => file.endsWith(".html"));
const errors = [];
const totals = { pages: 0, images: 0, inlineScripts: 0, localLinks: 0, stylesheets: 0 };
// 把站点绝对路径（以 / 开头）解析成 dist 中的本地文件路径并判断它是否存在；
// 以 / 结尾的地址会自动补上 index.html，对应构建后的目录首页。
const exists = async (url) => {
  const pathname = decodeURIComponent(new URL(url, "https://local.invalid").pathname);
  let file = path.join(dist, pathname);
  if (pathname.endsWith("/")) file = path.join(file, "index.html");
  try { await fs.access(file); return true; } catch { return false; }
};
for (const file of files) {
  const html = await fs.readFile(path.join(root, file), "utf8");
  const document = parse(html), checks = [];
  const ids = new Set(), references = [], styles = [];
  let blogRows = 0, compactRows = 0;
  // 递归遍历解析后的 DOM 树：收集 id、aria-controls 引用，统计图片/样式表/站内链接，
  // 并对内联脚本做语法校验，把这些检查结果累积到 ids / references / checks / errors 中。
  const walk = (node) => {
    const attributes = Object.fromEntries((node.attrs ?? []).map((attribute) => [attribute.name, attribute.value]));
    if (attributes.id) {
      if (ids.has(attributes.id)) errors.push(`${file}: duplicate id ${attributes.id}`);
      ids.add(attributes.id);
    }
    if (attributes["aria-controls"]) references.push(...attributes["aria-controls"].split(/\s+/));
    if (attributes.class?.split(" ").includes("blog-post-row")) blogRows++;
    if (attributes.class?.includes("compact-post-row")) compactRows++;
    // 图片：统计数量，站内绝对路径图片要确认文件存在，/manga/ 图片必须有宽高以免布局抖动。
    if (node.tagName === "img") {
      totals.images++;
      if (attributes.src?.startsWith("/")) checks.push([attributes.src, exists(attributes.src)]);
      if (attributes.src?.includes("/manga/") && (!attributes.width || !attributes.height)) errors.push(`${file}: unstable image dimensions`);
    }
    if (node.tagName === "link" && attributes.rel === "stylesheet") {
      totals.stylesheets++;
      styles.push(attributes.href);
      if (attributes.href?.startsWith("/")) checks.push([attributes.href, exists(attributes.href)]);
    }
    if (node.tagName === "a" && attributes.href?.startsWith("/themes/lumen-kael-xystus/")) {
      totals.localLinks++;
      checks.push([attributes.href, exists(attributes.href)]);
    }
    // 内联脚本（无 src、无 type）：用 vm.Script 只做语法解析，语法错会记入 errors。
    if (node.tagName === "script" && !attributes.src && !attributes.type) {
      const script = node.childNodes?.map((child) => child.value ?? "").join("") ?? "";
      try { new vm.Script(script); totals.inlineScripts++; } catch (error) { errors.push(`${file}: ${error.message}`); }
    }
    if (node.tagName === "script" && attributes.src?.startsWith("/")) checks.push([attributes.src, exists(attributes.src)]);
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(document);
  // 遍历完成后统一校验：aria-controls 必须指向存在的 id，所有被检查的资源必须真实存在。
  for (const reference of references) if (!ids.has(reference)) errors.push(`${file}: missing aria-controls target ${reference}`);
  for (const [resource, result] of checks) if (!(await result)) errors.push(`${file}: missing ${resource}`);
  // 首页只能加载首页样式；内页必须恰好带两份内页样式表；博客归档不能缺失或重复；
  // 正则 /(?:manga|refresh)-pages/ 用来识别内页样式表，/lumenkaelxystus[12]\.mp4/ 用来发现被排除的视频引用。
  const home = file === "index.html";
  if (home && styles.some((style) => /(?:manga|refresh)-pages/.test(style))) errors.push("Home loaded an inner-page stylesheet");
  if (!home && styles.filter((style) => /(?:manga|refresh)-pages/.test(style)).length !== 2) errors.push(`${file}: missing inner-page styles`);
  if (file.replaceAll("\\", "/") === "blog/index.html" && (!blogRows || compactRows)) errors.push("Blog has a missing or duplicate archive");
  if (/lumenkaelxystus[12]\.mp4/.test(html)) errors.push(`${file}: excluded video referenced`);
  totals.pages++;
}
console.log(JSON.stringify(totals));
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else console.log("lumenkaelxystus production audit passed.");
