/*
 * 一次性样式拆分脚本（lumenkaelxystus 主题）。
 *
 * 【使用场景】仅在需要把首页样式与内页样式分离时手动运行一次（脚本内置防重跑检查）。
 *   它把 refresh.css / manga.css 中只属于内页的规则移动到一个新的 *-pages.css，
 *   使首页不再加载内页样式，减小首页体积。
 * 【读入】src/themes/lumen-kael-xystus/styles/ 下的 refresh.css 与 manga.css。
 * 【产出】原地改写这两个文件，并新建 refresh-pages.css 与 manga-pages.css；
 *   新文件带一行说明注释。若目标已存在会报错，防止重复运行。
 * 【运行命令】在项目根目录执行：node themes/lumen-kael-xystus/tools/split-page-styles.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

// 样式表所在目录；innerClass 正则列出所有"只属于内页"的 class 前缀，
// 用于判定一条 CSS 规则是否应被搬走。
const directory = path.resolve("src/themes/lumen-kael-xystus/styles");
const innerClass = /^(?:blog-|post-|compact-post-|timeline-|page-title|works-|about-|article|prose$|meta-row$|tag-row$|game-|back-link$|not-found|archive-|workshop-|playroom-|memory-album|album-|lost-|manga-page-stamp)/;
for (const name of ["refresh", "manga"]) {
  const file = path.join(directory, `${name}.css`);
  const target = path.join(directory, `${name}-pages.css`);
  // 防重跑保护：目标文件一旦存在就报错（ENOENT 表示不存在，属于正常情况）。
  try {
    await fs.access(target);
    throw new Error(`${target} already exists; this one-time split must not run twice`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const source = await fs.readFile(file, "utf8");
  const sheet = postcss.parse(source);
  const pages = postcss.root();
  // 递归遍历 CSS 节点：@media 块原样保留结构继续下沉；普通规则若其所有 class
  // 都匹配 innerClass，就克隆到输出并从未拆分文件中删除（只移走"纯内页"规则）。
  const move = (container, output) => {
    for (const node of [...container.nodes]) {
      if (node.type === "atrule" && node.nodes && node.name === "media") {
        const media = node.clone({ nodes: [] });
        move(node, media);
        if (media.nodes.length) output.append(media);
        if (!node.nodes.length) node.remove();
      } else if (node.type === "rule") {
        // 用 selector-parser 提取这条规则选择器里的全部 class 名，再逐个与 innerClass 比对。
        const names = [];
        selectorParser((selectors) => selectors.walkClasses((value) => names.push(value.value))).processSync(node.selector);
        if (names.length && names.every((value) => innerClass.test(value))) {
          output.append(node.clone());
          node.remove();
        }
      }
    }
  };
  move(sheet, pages);
  // Preserve the input file's line-ending convention during this mechanical split.
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const serialize = (value) => value.toString().replace(/\r?\n/g, newline);
  await fs.writeFile(file, serialize(sheet));
  await fs.writeFile(target, `/* Inner-page presentation; intentionally absent from Home. */${newline}${serialize(pages)}${newline}`);
  console.log(`${name}: moved ${pages.toString().length} characters to inner pages`);
}
