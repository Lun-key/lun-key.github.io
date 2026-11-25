/**
 * 【文件头】首页"日志/手记"区块的滚动渐入动画脚本,只在浏览器端运行。
 * 由首页对应区块的组件 import 并调用 mountHomeJournal() 挂载。
 * 它用 Web Animations API 让标题、边注、条目在滚动进入视口时淡入上移,
 * 并且尊重"减少动效"偏好和键盘/焦点导航。改它会影响这些元素的入场效果。
 */
/**
 * 挂载日志区块的滚动驱动动画。
 * @param {Element} root 日志区块容器;为空则返回空清理函数
 * @param {Window} win 目标 window,默认当前窗口(便于测试时传入模拟对象)
 * @returns {Function} 清理函数:取消动画、断开 observer、移除所有监听
 */
export function mountHomeJournal(root, win = window) {
  if (!root) return () => {};
  // 找出所有要做动画的元素;matchMedia 用来检测用户是否开启了"减少动态效果"。
  const elements = [...root.querySelectorAll(".journal-heading, .journal-margin-note, .journal-entry")];
  const doc = root.ownerDocument;
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  // 没有目标元素,或浏览器不支持 element.animate(Web Animations API)时直接跳过。
  if (!elements.length || elements.some(element => typeof element.animate !== "function")) return () => {};
  const animations = [];
  let frame = 0, disposed = false, visible = true;
  const duration = 240, stagger = 50; // 每个动画时长,以及相邻元素错开的间隔
  const total = duration + (elements.length - 1) * stagger; // 全部元素的总时长
  // 取消待执行的帧,并取消/splice 清空所有正在播放的动画。
  const clear = () => {
    win.cancelAnimationFrame(frame);
    frame = 0;
    animations.splice(0).forEach(animation => animation.cancel());
  };
  /**
   * 根据区块距视口的位置算出 0~1 的进度,再直接设置每个动画的 currentTime,
   * 这样动画进度就"绑定"到了滚动条上,而不是自己播放。
   */
  const update = () => {
    frame = 0;
    if (disposed || doc.hidden || reduced.matches) return;
    const distance = Math.min(300, win.innerHeight * .45);
    const progress = Math.max(0, Math.min(1, (win.innerHeight - root.getBoundingClientRect().top) / distance));
    for (const animation of animations) animation.currentTime = progress * total;
  };
  // 节流:一帧最多安排一次 update,用 frame 是否非零来判断"已排期"。
  const schedule = () => {
    if (!disposed && visible && !doc.hidden && !reduced.matches && !frame) frame = win.requestAnimationFrame(update);
  };
  /**
   * 重新创建所有动画并暂停,等待滚动来推进度。
   * element.animate(关键帧, 选项) 是 Web Animations API:fill:"both" 保持首尾帧,
   * delay 用 index*stagger 实现依次入场。
   */
  const prepare = () => {
    clear();
    if (disposed || reduced.matches) return;
    elements.forEach((element, index) => {
      const animation = element.animate([
        { opacity: 0, transform: "translate3d(0, 18px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ], { duration, delay: index * stagger, easing: "cubic-bezier(.23, 1, .32, 1)", fill: "both" });
      animation.pause();
      animations.push(animation);
    });
    update();
  };
  // 键盘或焦点主动导航时取消动画,让内容立刻完整显示,避免半透明状态影响阅读。
  const navigate = event => {
    // Keep explicit keyboard and focus navigation fully visible.
    if (event.type === "focusin" || ["Tab", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", " "].includes(event.key)) clear();
  };
  // IntersectionObserver 会在元素进入/离开视口时回调,这里据此开关动画更新,
  // 元素不在视口就停更以省性能(老浏览器没有这个 API 时降级跳过)。
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    // Update at exit too, so a large scroll never leaves a stale partial frame.
    update();
  }) : null;
  // scroll/resize 高频事件用 schedule 节流;页面隐藏、键盘、焦点、偏好变化各有对应处理。
  observer?.observe(root);
  win.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("pagehide", clear);
  win.addEventListener("pageshow", prepare);
  doc.addEventListener("visibilitychange", schedule);
  doc.addEventListener("keydown", navigate);
  root.addEventListener("focusin", navigate);
  reduced.addEventListener("change", prepare);
  prepare();
  // 清理函数:标记已销毁、清动画、断开 observer、逐个移除监听。
  return () => {
    disposed = true;
    clear();
    observer?.disconnect();
    win.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
    win.removeEventListener("pagehide", clear);
    win.removeEventListener("pageshow", prepare);
    doc.removeEventListener("visibilitychange", schedule);
    doc.removeEventListener("keydown", navigate);
    root.removeEventListener("focusin", navigate);
    reduced.removeEventListener("change", prepare);
  };
}
