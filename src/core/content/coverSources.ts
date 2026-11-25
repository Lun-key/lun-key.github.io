/**
 * 博客封面的“响应式图片源（srcset）工具。
 * 读取构建期生成的 responsive-covers.json 清单，为 <img> 生成 srcset / sizes，并判断封面是否带透明。
 * srcset 让浏览器按屏幕宽度挑合适尺寸的图，避免小屏下载大图；sizes 告诉浏览器各断点下图片会显示多宽。
 * 被引用：getCoverSources → 首页 / 博客列表页的封面 <img>；hasTransparentCover → 区分透明封面的样式逻辑。
 *  srcset 拼接规则会改变浏览器选图行为；宽高清单由构建脚本生成，不要手改 json。
 */
// manifest：构建期生成的封面清单（每张封面有哪些宽度版本、是否不透明）。
import manifest from "./responsive-covers.json" with { type: "json" };

// CoverSizes：清单里单张封面的结构 —— width 原始宽度，opaque 为 true 表示不透明，variants 是各尺寸版本。
type CoverSizes = {
  width: number;
  opaque?: boolean;
  variants: { src: string; width: number }[];
};

export function hasTransparentCover(source: string | null | undefined) {
  return source ? (manifest as Record<string, CoverSizes>)[source]?.opaque !== true : false;
}

// 生成 <img> 用的 { srcset, sizes }：列出各尺寸版本 + 原图；查不到清单时返回空对象，退回普通 src。
export function getCoverSources(source: string | null | undefined, sizes: string) {
  const cover = source ? (manifest as Record<string, CoverSizes>)[source] : undefined;
  if (!cover?.variants.length) return {};
  return {
    // 每个变体写成 "路径 宽度w"，最后补上原图；浏览器据此自动挑最合适的一张。
    srcset: [...cover.variants.map(variant => `${variant.src} ${variant.width}w`), `${source} ${cover.width}w`].join(", "),
    sizes
  };
}
