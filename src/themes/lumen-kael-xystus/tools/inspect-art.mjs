/*
 * 图片素材检查脚本（lumenkaelxystus 主题）。
 *
 * 【使用场景】准备/审查漫画图片素材时手动运行：把 lumenkaelxystus/ 里的原始图片做成
 *   联系表（contact sheet）和背景图预览，方便人工快速翻看、挑图并核对页面编号。
 * 【读入】项目根目录下 lumenkaelxystus/ 里的 .jpg/.png/.webp 图片；以及
 *   public/themes/lumen-kael-xystus/assets 下的 hero-wallpaper.jpg 和 lumen-kael-xystus-bg.png。
 * 【产出】在系统临时目录 lumenkaelxystus-art-review/ 下生成 inventory.json（尺寸/体积清单）、
 *   contact-1.jpg 与 contact-2.jpg（缩略图联系表）、两张背景图的 -review.jpg 预览；
 *   并把生成文件路径和字节数打印到控制台。脚本只读原图，不改动任何源文件。
 * 【运行命令】在项目根目录执行：node themes/lumen-kael-xystus/tools/inspect-art.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const root = process.cwd();
// 所有中间产物都写到系统临时目录，避免污染项目源码。
const output = path.join(os.tmpdir(), "lumenkaelxystus-art-review");
await fs.mkdir(output, { recursive: true });
// 只保留图片扩展名（正则忽略大小写），并按数字顺序排序，让 p2 排在 p10 前面。
const names = (await fs.readdir(path.join(root, "lumenkaelxystus")))
  .filter((name) => /\.(jpg|png|webp)$/i.test(name))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const inventory = [];
for (const name of names) {
  const file = path.join(root, "lumenkaelxystus", name);
  // 用 sharp 读取图片元数据，记录宽、高和文件字节数到库存清单。
  const meta = await sharp(file).metadata();
  inventory.push({ name, width: meta.width, height: meta.height, bytes: (await fs.stat(file)).size });
}
await fs.writeFile(path.join(output, "inventory.json"), JSON.stringify(inventory, null, 2));
// 分两批（每批最多 30 张）生成联系表；每格先放缩放后的缩略图，再叠加一行页码文字标签。
for (let batch = 0; batch < 2; batch++) {
  const selected = inventory.slice(batch * 30, (batch + 1) * 30);
  const cells = [];
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    // 联系表按每行 6 格排布：left 决定列，top 决定行（每格 190×270）。
    const left = (i % 6) * 190;
    const top = Math.floor(i / 6) * 270;
    cells.push({
      input: await sharp(path.join(root, "lumenkaelxystus", item.name))
        .resize(180, 240, { fit: "contain", background: "#ffffff" }).jpeg({ quality: 75 }).toBuffer(),
      left, top
    });
    const label = item.name.match(/(93251996|102800687)_p(\d+)/);
    cells.push({
      input: Buffer.from(`<svg width="190" height="25"><text x="5" y="17" font-size="13" fill="#334">${label[1] === "93251996" ? "V4" : "V8"} / p${label[2]}</text></svg>`),
      left, top: top + 242
    });
  }
  const file = path.join(output, `contact-${batch + 1}.jpg`);
  await sharp({ create: { width: 1140, height: Math.ceil(selected.length / 6) * 270, channels: 3, background: "#edf2f5" } })
    .composite(cells).jpeg({ quality: 79 }).toFile(file);
  console.log(file, (await fs.stat(file)).size);
}
// 额外把两张关键背景图等比缩放到 1280×900 以内并展平透明背景，输出便于查看的 JPG 预览。
for (const name of ["hero-wallpaper.jpg", "lumen-kael-xystus-bg.png"]) {
  const file = path.join(output, name.replace(/\.[^.]+$/, "-review.jpg"));
  await sharp(path.join(root, "public/themes/lumen-kael-xystus/assets", name))
    .resize({ width: 1280, height: 900, fit: "inside" }).flatten({ background: "#fff" })
    .jpeg({ quality: 83 }).toFile(file);
  console.log(file, (await fs.stat(file)).size);
}
