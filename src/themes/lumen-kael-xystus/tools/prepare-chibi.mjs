/*
 * Q版（chibi）立绘生成脚本（lumenkaelxystus 主题）。
 *
 * 【使用场景】准备 Q 版角色小图时手动运行：从 lumenkaelxystus/chibi/ 的原始插画里
 *   去掉与画面外缘相连的纸张背景，做成透明底的 WebP 立绘，并写出清单。
 * 【读入】selections 里逐项指定的 lumenkaelxystus/chibi/ 原始 jpg；可选的 protectedMask
 *   保护遮罩 SVG（如毛毯这种融进白纸、没有闭合描边的区域）。
 * 【产出】public/themes/lumen-kael-xystus/assets/manga/ 下的 <name>.webp 与
 *   chibi-manifest.json；控制台打印各产物尺寸和总体积。
 * 【运行命令】在项目根目录执行：node themes/lumen-kael-xystus/tools/prepare-chibi.mjs
 *   若需向已有清单追加条目（且校验现有产物未被改动），加参数：--extend-manifest
 *   本文件同时被测试导入（导出 selections、removePaper、prepareChibi）。
 *
 * 注意：原始素材只读；已有英文注释说明了"只去掉与外缘相连的纸张、保留封闭的
 * 头发/眼睛/衣服"以及"保护遮罩""去除游离文字"等约束，务必保留。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 待生成的 Q 版清单。每项字段：name=输出文件名；source=原始图片名；
// context=使用场景说明；paperThreshold=判定"纸张"的亮度阈值（默认 239）；
// exclusions=要抹成透明的区域（如原图自带的文字）；protectedMask=需要保留的保护遮罩。
export const selections = [
  { name: "haruto-reading", source: "99276931-ec31ffa9121e9fd5b71bdc2b83297fec_p23_master1200.jpg", context: "reviewing a project draft" },
  { name: "haruto-cat", source: "118585778-bb417dca766669532f3b92502dd5f000_p26_master1200.jpg", context: "after-school leisure" },
  { name: "kagari-schoolbag", source: "99276931-ec31ffa9121e9fd5b71bdc2b83297fec_p16_master1200.jpg", context: "opening the notebook chapter" },
  {
    name: "kagari-soba", source: "123340700-1b8126f0889c63c0b459fa1ae54c0651_p13_master1200.jpg",
    context: "ordinary moments beside the journal",
    paperThreshold: 246,
    exclusions: [{ left: 502, top: 100, width: 150, height: 150 }]
  },
  {
    name: "kagari-sleeve", source: "123340700-1b8126f0889c63c0b459fa1ae54c0651_p28_master1200.jpg",
    context: "welcoming the reader beside the profile",
    paperThreshold: 246,
    exclusions: [{ left: 555, top: 75, width: 95, height: 180 }, { left: 245, top: 180, width: 40, height: 105 }]
  },
  {
    name: "kagari-cozy", source: "118585778-bb417dca766669532f3b92502dd5f000_p17_master1200.jpg",
    context: "a quiet personal introduction", paperThreshold: 246
  },
  {
    name: "kagari-rest", source: "123340700-1b8126f0889c63c0b459fa1ae54c0651_p22_master1200.jpg",
    context: "a restful after-school break", paperThreshold: 246,
    protectedMask: "src/themes/lumen-kael-xystus/art/kagari-rest-paper-mask.svg",
    exclusions: [{ left: 60, top: 35, width: 80, height: 120 }, { left: 60, top: 155, width: 50, height: 140 }]
  }
];

// Only outside-connected paper is removed: enclosed hair, eyes and clothes stay opaque.
export function removePaper(rgb, width, height, exclusions = [], threshold = 239, protectedAlpha) {
  const count = width * height;
  const paper = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0, tail = 0;
  // 泛洪填充：从边界向内只把"足够亮且接近灰白"的像素当作纸张，
  // 用队列做广度优先扩散；threshold 与色差上限 18 控制哪些像素算纸。
  const visit = (i) => {
    if (paper[i]) return;
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (Math.min(r, g, b) < threshold || Math.max(r, g, b) - Math.min(r, g, b) > 18) return;
    paper[i] = 1;
    queue[tail++] = i;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (x) visit(i - 1);
    if (x + 1 < width) visit(i + 1);
    if (i >= width) visit(i - width);
    if (i + width < count) visit(i + width);
  }
  const rgba = Buffer.alloc(count * 4);
  for (let i = 0; i < count; i++) {
    rgb.copy(rgba, i * 4, i * 3, i * 3 + 3);
    rgba[i * 4 + 3] = paper[i] ? 0 : 255;
    if (paper[i]) continue;
    const x = i % width, y = Math.floor(i / width);
    const exteriorEdge = (x > 0 && paper[i - 1]) || (x + 1 < width && paper[i + 1]) ||
      (y > 0 && paper[i - width]) || (y + 1 < height && paper[i + width]);
    const pixel = rgb.subarray(i * 3, i * 3 + 3);
    const low = Math.min(...pixel), high = Math.max(...pixel);
    // 对紧挨纸张的浅色边缘做半透明羽化（soft matte），消除白边锯齿；
    // 只对亮度较高、颜色较中性的像素生效，避免吃掉角色的浅色细节。
    if (!exteriorEdge || low < 200 || high - low > 28) continue;
    const alpha = (255 - low) / 55;
    rgba[i * 4 + 3] = Math.round(alpha * 255);
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.max(0, Math.round((pixel[c] - 255 * (1 - alpha)) / alpha));
  }
  // The floral blanket fades into white paper without a closed ink outline.
  if (protectedAlpha) {
    for (let i = 0; i < count; i++) {
      if (!protectedAlpha[i] || protectedAlpha[i] < rgba[i * 4 + 3]) continue;
      rgb.copy(rgba, i * 4, i * 3, i * 3 + 3);
      rgba[i * 4 + 3] = protectedAlpha[i];
    }
  }
  // Remove only the source's detached lettering, outside the character silhouette.
  for (const rect of exclusions) {
    for (let y = rect.top; y < Math.min(height, rect.top + rect.height); y++) {
      for (let x = rect.left; x < Math.min(width, rect.left + rect.width); x++) rgba[(y * width + x) * 4 + 3] = 0;
    }
  }
  return rgba;
}

// 计算 Buffer 内容的 SHA-256，写入清单以记录来源与产物、并防止覆盖已有文件。
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

// 主流程：root 指定项目根目录；extendManifest=true 时允许在保留旧产物的前提下追加清单。
// 每个产物若已存在且内容不同，会拒绝覆盖（flag:"wx" 表示文件已存在就写入失败）。
export async function prepareChibi(root = process.cwd(), { extendManifest = false } = {}) {
  const destination = path.join(root, "public/themes/lumen-kael-xystus/assets/manga");
  await fs.mkdir(destination, { recursive: true });
  const manifest = { version: 1, operation: "outside-connected paper removal, soft matte edge, detached caption removal; originals unchanged", outputs: [] };
  for (const selection of selections) {
    const source = `lumenkaelxystus/chibi/${selection.source}`;
    const original = await fs.readFile(path.join(root, source));
    const { data, info } = await sharp(original).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = selection.protectedMask ? await fs.readFile(path.join(root, selection.protectedMask)) : null;
    const protectedAlpha = mask ? await sharp(mask).ensureAlpha().extractChannel(3).blur(2).raw().toBuffer() : undefined;
    const rgba = removePaper(data, info.width, info.height, selection.exclusions, selection.paperThreshold, protectedAlpha);
    const { data: output, info: result } = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .trim({ threshold: 1 }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: "#00000000" })
      .webp({ quality: 94, alphaQuality: 100, smartSubsample: true, effort: 6 }).toBuffer({ resolveWithObject: true });
    const file = `${selection.name}.webp`;
    const target = path.join(destination, file);
    const existing = await fs.readFile(target).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
    if (existing && !existing.equals(output)) throw new Error(`Refusing to overwrite ${target}; back up and review the existing derivative first.`);
    if (!existing) await fs.writeFile(target, output, { flag: "wx" });
    manifest.outputs.push({
      file, width: result.width, height: result.height, bytes: output.length, sha256: sha256(output),
      source, sourceSha256: sha256(original), sourceWidth: info.width, sourceHeight: info.height,
      exclusions: selection.exclusions ?? [], paperThreshold: selection.paperThreshold ?? 239, context: selection.context
    });
    if (mask) Object.assign(manifest.outputs.at(-1), { protectedMask: selection.protectedMask, protectedMaskSha256: sha256(mask) });
  }
  const target = path.join(destination, "chibi-manifest.json");
  const serialized = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  const existing = await fs.readFile(target).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
  const unchanged = existing && JSON.stringify(JSON.parse(existing)) === JSON.stringify(manifest);
  if (existing && !unchanged) {
    const previous = JSON.parse(existing);
    const preservesDerivatives = previous.outputs.every((old) => manifest.outputs.some((next) =>
      next.file === old.file && next.sha256 === old.sha256 && next.sourceSha256 === old.sourceSha256));
    if (!extendManifest || !preservesDerivatives) throw new Error(`Refusing to overwrite ${target}; review and back up the previous manifest first.`);
    await fs.writeFile(target, serialized);
  } else if (!existing) await fs.writeFile(target, serialized, { flag: "wx" });
  return manifest;
}

// 仅当本文件被直接"node 运行"时才执行生成；被测试 import 时不会触发。
// --extend-manifest 命令行参数决定是否允许向已有清单追加条目。
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = await prepareChibi(process.cwd(), { extendManifest: process.argv.includes("--extend-manifest") });
  console.log(JSON.stringify({ outputs: manifest.outputs.map(({ file, width, height, bytes }) => ({ file, width, height, bytes })), totalBytes: manifest.outputs.reduce((sum, output) => sum + output.bytes, 0) }, null, 2));
}
