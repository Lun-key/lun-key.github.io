/**
 * 封面“焦点位置”配置（coverFocus.ts）。
 * 做什么：为个别封面指定 object-position 焦点（图片被裁切时保留哪一块），返回可写进 style 的 CSS 变量字符串。
 * 被谁引用：HomePage、BlogIndexPage 的封面外框 style={getCoverStyle(...)}；tests/refresh.test.mjs 有断言。
 * 改它会怎样：给某张封面加一行即可调它的裁切焦点；值是 CSS 的“水平% 垂直%”，可在此文件里试。
 * 教学：这里只覆盖需要特殊处理的封面，没登记的返回 undefined，页面就用默认焦点。
 */
// 键是封面路径，值是 CSS object-position（水平% 垂直%）。想调某张图的取景就改这里。
const coverFocus: Record<string, string> = {
  "/blog-covers/cover-08.webp": "50% 30%"
};

// 查到焦点就返回 "--cover-focus: 50% 30%;" 这样的内联样式，否则返回 undefined。
export function getCoverStyle(cover: string | null | undefined) {
  const focus = coverFocus[cover ?? ""];
  return focus ? `--cover-focus: ${focus};` : undefined;
}
