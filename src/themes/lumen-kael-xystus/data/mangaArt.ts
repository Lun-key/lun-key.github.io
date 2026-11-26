/**
 * 漫画风插画的清单与取图函数（mangaArt.ts）。
 * 做什么：用 images 记录每张插画的原始宽高，mangaArt() 按名字返回 { src, width, height }，供 <img> 直接用。
 * 被谁引用：components/LayeredHero.astro、components/MangaArt.astro、ChapterRail.astro（取 MangaImage 类型）。
 * 改它会怎样：加/改一张插画：在 images 里加一行 [宽, 高]，并把对应 webp 放到 assets/manga/ 下即可。
 * 教学：as const 让 images 的键成为字面量类型，MangaImage 用 keyof 取出所有合法图片名，写错名字会报错。
 */
import { lumenAssets } from "../assets";

// 每张插画的原始尺寸 [宽, 高]：填对能让浏览器预留空间、避免图片加载时布局跳动。
const images = {
  "festival-cover": [750, 1050],
  "afternoon-cover": [800, 1130],
  "together-cover": [800, 1130],
  "notebook-page": [700, 1013],
  "workshop-page": [625, 850],
  "playroom-page": [700, 1013],
  "letter-page": [625, 850],
  "fireworks-page": [625, 850],
  "reading-strip": [653, 430],
  "workshop-strip": [580, 305],
  "playroom-strip": [644, 480],
  "hand-note": [570, 252],
  "kagari-tea": [280, 510],
  "haruto-gift": [280, 540],
  "festival-pair": [490, 569],
  "kagari-thinking": [328, 512],
  "haruto-thinking": [263, 596],
  "haruto-reading": [284, 588],
  "haruto-cat": [369, 503],
  "kagari-schoolbag": [288, 519],
  "kagari-soba": [361, 429],
  "kagari-sleeve": [477, 449],
  "kagari-cozy": [269, 460],
  "kagari-rest": [533, 377],
  "hero-character": [1920, 1080],
  "hero-manga": [1920, 1080]
} as const;

// MangaImage 类型 = images 的所有键；这样调用 mangaArt 时写错图片名，TypeScript 会直接报错。
export type MangaImage = keyof typeof images;
// 按图片名生成完整信息：src 走 lumenAssets 拼 URL，宽高取自上面的清单。
export const mangaArt = (name: MangaImage) => ({
  src: lumenAssets(`manga/${name}.webp`),
  width: images[name][0],
  height: images[name][1]
});
