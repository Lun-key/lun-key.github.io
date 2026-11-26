/**
 * 本主题的静态资源路径工具（assets.ts）。
 * 做什么：lumenAssets 把相对文件名拼成完整 URL；lumenAssets 预热并集中导出常用图片的 URL。
 * 被谁引用：BaseLayout、AboutPage、BlogIndexPage、HomePage 以及 data/mangaArt.ts 都用它取图片/图标路径。
 * 改它会怎样：改 themeRoot 会改变所有资源的基础路径；新增图片后，在 lumenAssets 里加一项即可复用。
 * 教学：资源放在 public/themes/lumen-kael-xystus/assets/ 下，浏览器用这里的 URL 直接访问。
 */
// 本主题在 public 下的根路径；资产文件都放在它下面的 assets/ 目录里。
// import.meta.env.BASE_URL 在 GitHub Pages 子路径部署时为 "/Lumen-Kael-Xystus.io/"，本地为 "/"。
// 用 replace 去掉尾部斜杠再拼接，避免产生双斜杠。
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const themeRoot = `${base}/themes/lumen-kael-xystus`;

export const lumenAssets = Object.assign(
  (path: string) => `${themeRoot}/assets/${path.replace(/^\/+/, "")}`,
  {
    favicon: `${themeRoot}/assets/mascot-favicon-navy.png`,
    appleTouchIcon: `${themeRoot}/assets/mascot-apple-touch.png`,
    brand: `${themeRoot}/assets/mascot-brand.webp`,
    scrollPig: `${themeRoot}/assets/mini-mascot-scroll.webp`,
    profile: `${themeRoot}/assets/profile.webp`,
    heroWallpaper: `${themeRoot}/assets/hero-wallpaper.webp`,
    pageBackground: `${themeRoot}/assets/lumen-kael-xystus-bg.webp`,
    notFound: `${themeRoot}/assets/legacy/404.webp`,
    // 音乐清单不在 assets/ 下，而在同级 music/ 目录，所以单独用 themeRoot 拼。
    musicManifest: `${themeRoot}/music/manifest.json`
  }
);
