/**
 * 【文件头】首页场景切换(转场)脚本,只在浏览器端运行,被首页组件 import。
 * 它接管桌面端的滚轮:在"首屏 → 漫画轨道 → 正文背景"三个场景的边界处,
 * 用一个覆盖层做遮罩擦除(wipe)或淡入淡出(fade)转场,替代生硬的原生滚动。
 * 只在精确指针、未减少动效、非省流等条件下启用。改它会影响首页各段之间的切换手感。
 */
const easeOut = "cubic-bezier(.23, 1, .32, 1)"; // 缓出曲线:起步快、结尾慢
const easeInOut = "cubic-bezier(.77, 0, .175, 1)"; // 缓入缓出曲线:两头慢
const lockClass = "is-lumenkaelxystus-transition-locked"; // 转场期间锁滚动用的 CSS 类

/**
 * 挂载首页转场控制。
 * @param {Window} win 目标 window,默认当前窗口
 * @param {Document} doc 目标 document,默认当前文档
 * @returns {{enterContents: Function, setHeroReady: Function, isRunning: Function, cleanup: Function}}
 *   控制对象:enterContents 触发"进入正文"转场,setHeroReady 更新首屏就绪状态,
 *   isRunning 查询是否在转场中,cleanup 卸载(移除覆盖层与所有监听)。
 *   页面缺少必要节点时返回同结构的空实现,避免调用方报错。
 */
export function mountHomeTransitions(win = window, doc = document) {
  const hero = doc.querySelector("[data-hero-stage]");
  const rail = doc.querySelector("[data-manga-rail]");
  const railStage = rail?.querySelector(".chapter-rail-stage");
  const nextScene = doc.querySelector(".home-content-bg");
  if (!hero || !railStage || !nextScene) return { enterContents() {}, setHeroReady() {}, isRunning: () => false, cleanup() {} };
  // matchMedia 读取系统偏好:reduced=减少动效,fine=桌面精确指针且宽度达标。
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  const root = doc.documentElement;
  // 动态创建一个遮罩层元素盖在页面上;aria-hidden 让它不被读屏器朗读。
  const screen = doc.createElement("div");
  screen.className = "lumenkaelxystus-home-transition";
  screen.setAttribute("aria-hidden", "true");
  screen.hidden = true;
  doc.body.append(screen);
  const animations = new Set();
  const timers = new Map();
  const removers = [];
  let running = false, disposed = false, generation = 0, lockedY = 0;
  let direction = 1, reversePull = 0, reverse = null;
  let previousY = win.scrollY, nativeNavigation = Boolean(win.location?.hash);
  let heroReady = false;
  // 注册监听时把对应的卸载函数存进 removers,cleanup 时统一移除。
  const listen = (node, type, callback, options) => {
    node.addEventListener(type, callback, options);
    removers.push(() => node.removeEventListener(type, callback, options));
  };
  // 是否允许转场:未销毁、未减少动效、桌面精确指针、页面可见、无弹层、支持动画。
  const allowed = () => !disposed && !reduced.matches && fine.matches && !doc.hidden
    && !root.classList.contains("is-notice-open") && typeof screen.animate === "function";
  // 几个位置换算工具:top 取元素相对文档顶部的绝对 Y;railStart/railEnd 是轨道可滚动区间。
  const top = element => element.getBoundingClientRect().top + win.scrollY;
  const railStart = () => top(rail);
  const railEnd = () => railStart() + Math.max(0, rail.offsetHeight - railStage.clientHeight);
  // 把不同 deltaMode(像素/行/页)的滚轮量统一换算成像素。
  const delta = event => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? win.innerHeight : 1);
  // 哪些滚轮事件要放过:按了 Ctrl/Meta(浏览器缩放)、主要是横向滚动、或焦点在输入控件/弹层里。
  const ignoresWheel = event => event.ctrlKey || event.metaKey || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY)
    || event.target?.closest?.("input, select, textarea, [contenteditable], .toy-dock, [role=dialog]");
  // CustomEvent 式的通知:派发一个自定义事件 lumenkaelxystus:home-scene-ready 告诉外部"场景切换完成"。
  const sceneReady = () => doc.dispatchEvent(new win.Event("lumenkaelxystus:home-scene-ready"));
  // 清掉所有正在跑的动画和等待中的定时器;resolve() 让 wait() 里的 Promise 立即结束。
  const clearAnimations = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const [timer, resolve] of timers) { win.clearTimeout(timer); resolve(); }
    timers.clear();
  };
  // 收尾:停动画、藏遮罩、解除滚动锁;若本来在转场中则通知外部场景已就绪。
  const finish = (notify = true) => {
    const wasRunning = running;
    running = false;
    clearAnimations();
    screen.hidden = true;
    root.classList.remove(lockClass);
    previousY = win.scrollY;
    if (notify && wasRunning && !disposed && !doc.hidden && !reduced.matches) sceneReady();
  };
  // 取消当前转场:generation 自增会让进行中的异步流程检查到"令牌过期"而放弃。
  const cancel = () => {
    generation++;
    reverse = null;
    finish();
  };
  // 对元素做一次 Web Animations 动画并登记到 animations,便于统一取消。
  const animate = (element, frames, duration, delay = 0, easing = easeOut) => {
    const animation = element.animate(frames, { duration, delay, easing, fill: "both" });
    animations.add(animation);
    return animation;
  };
  // 等待一个动画结束,但用定时器兜底(动画被取消时 finished 不会 resolve,防止永久卡住)。
  const wait = async (animation, duration) => {
    let timer;
    await Promise.race([
      animation.finished.catch(() => {}),
      new Promise(resolve => {
        timer = win.setTimeout(resolve, duration + 100);
        timers.set(timer, resolve);
      }),
    ]);
    win.clearTimeout(timer);
    timers.delete(timer);
  };
  // 转场揭开时,让目标场景里的元素依次淡入上移;wipe 带横向位移,fade 带纵向位移。
  const reveal = (target, kind, travelDirection) => {
    const elements = target === rail
      ? [rail.querySelector(".manga-section-heading"), ...rail.querySelectorAll(".chapter-leaf")]
      : target === hero ? [] : [...nextScene.querySelectorAll(".home-art-word, .home-signal-card, .home-welcome-bubble")];
    return elements.filter(element => element?.animate).map((element, index) => {
      const settled = win.getComputedStyle(element).transform;
      const base = settled === "none" ? "" : settled;
      return animate(element, [
        { opacity: 0, transform: `${base} translate3d(${kind === "wipe" ? travelDirection * 18 : 0}px, ${kind === "fade" ? 14 : 0}px, 0)` },
        { opacity: 1, transform: settled },
      ], 240, index * 50);
    });
  };
  /**
   * 执行一次完整转场:遮罩盖住 → 跳到目标位置并揭开目标场景 → 收尾。
   * generation 令牌保证中途被新操作打断时旧流程能安全退出;
   * 若在动画中检测到用户反向滚动(reverse),结束后立刻反向再切回去。
   */
  const transition = async (from, target, kind, travelDirection, destination, returnTo) => {
    if (running || !allowed()) return;
    const token = ++generation;
    const duration = kind === "fade" ? 240 : 300;
    direction = travelDirection;
    reversePull = 0;
    reverse = null;
    running = true;
    lockedY = win.scrollY;
    root.classList.add(lockClass);
    // Cancel any native smooth scroll before revealing the covering surface.
    // 在显示遮罩层前先取消浏览器可能正在进行的平滑滚动,避免位置漂移。
    win.scrollTo({ top: lockedY, behavior: "instant" });
    screen.hidden = false;
    const covered = { opacity: 1, clipPath: "inset(0)" };
    const enter = kind === "fade" ? { opacity: 0, clipPath: "inset(0)" }
      : { opacity: 1, clipPath: travelDirection > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" };
    const leave = kind === "fade" ? { opacity: 0, clipPath: "inset(0)" }
      : { opacity: 1, clipPath: travelDirection > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" };
    try {
      await wait(animate(screen, [enter, covered], duration, 0, kind === "fade" ? easeOut : easeInOut), duration);
      if (disposed || token !== generation) return;
      lockedY = destination();
      win.scrollTo({ top: lockedY, behavior: "instant" });
      const entrances = reveal(target, kind, travelDirection);
      const exitDuration = kind === "fade" ? 240 : 300;
      const exit = animate(screen, [covered, leave], exitDuration, 0, kind === "fade" ? easeOut : easeInOut);
      await Promise.all([
        wait(exit, exitDuration),
        ...entrances.map((animation, index) => wait(animation, 240 + index * 50)),
      ]);
      if (disposed || token !== generation) return;
      const shouldReverse = reverse;
      finish(!shouldReverse);
      if (shouldReverse) transition(target, from, kind, -travelDirection, returnTo, destination);
    } catch {
      if (token === generation) cancel();
    }
  };
  // 拦下滚轮默认行为并触发转场的快捷封装。
  const consume = (event, from, target, kind, travelDirection, destination, returnTo) => {
    event.preventDefault();
    transition(from, target, kind, travelDirection, destination, returnTo);
  };
  // 漫画轨道与正文之间的边界转场(wipe 擦除)。
  const coverRailBoundary = (travelDirection) => {
    const boundary = travelDirection > 0 ? railEnd() : top(nextScene);
    previousY = boundary;
    win.scrollTo({ top: boundary, behavior: "instant" });
    if (travelDirection > 0) transition(rail, nextScene, "wipe", 1, () => top(nextScene), railEnd);
    else transition(nextScene, rail, "wipe", -1, railEnd, () => top(nextScene));
  };
  // 首屏与漫画轨道之间的边界转场(fade 淡入淡出)。
  const coverHeroBoundary = (travelDirection) => {
    const boundary = travelDirection > 0 ? 0 : railStart();
    previousY = boundary;
    win.scrollTo({ top: boundary, behavior: "instant" });
    if (travelDirection > 0) transition(hero, rail, "fade", 1, railStart, () => 0);
    else transition(rail, hero, "fade", -1, () => 0, railStart);
  };
  // 从首屏"进入正文"的入口:由 home-hero 通关后调用,这里包装成一次 fade 转场。
  const enterContents = event => {
    if (!allowed() || running || event.defaultPrevented || ignoresWheel(event) || event.deltaY <= 0
      || !heroReady || win.scrollY >= railStart() - 2 || rail.dataset.railMode !== "scroll") return;
    event.preventDefault();
    coverHeroBoundary(1);
  };
  // 滚轮主处理器:转场进行中时累计反向滚动量决定是否中途掉头;
  // 否则根据当前 Y 落在哪个区间,判断该在哪条边界触发转场。
  const onWheel = event => {
    if (!allowed() || ignoresWheel(event)) return;
    const movement = delta(event);
    if (!movement) return;
    if (running) {
      event.preventDefault();
      reversePull = movement * direction < 0 ? reversePull + Math.abs(movement) : 0;
      reverse = reversePull >= 36;
      return;
    }
    if (event.defaultPrevented || rail.dataset.railMode !== "scroll"
      || root.classList.contains("is-lumenkaelxystus-hero-locked")) return;
    const start = railStart(), end = railEnd(), next = top(nextScene), y = win.scrollY;
    nativeNavigation = false;
    if ((heroReady || movement < 0) && y > 2 && y < start - 2) {
      event.preventDefault();
      coverHeroBoundary(movement > 0 ? 1 : -1);
      return;
    }
    if (y > end + 2 && y < next - 2) {
      event.preventDefault();
      coverRailBoundary(movement > 0 ? 1 : -1);
      return;
    }
    if (movement > 0 && y >= start - 2 && y <= end + 2) {
      if (y >= end - 2) consume(event, rail, nextScene, "wipe", 1, () => top(nextScene), railEnd);
      else if (y + movement > end) { event.preventDefault(); win.scrollTo({ top: end, behavior: "instant" }); }
    } else if (movement < 0 && y >= start - 2 && y <= end + 2) {
      if (y <= start + 2) consume(event, rail, hero, "fade", -1, () => 0, railStart);
      else if (y + movement < start) { event.preventDefault(); win.scrollTo({ top: start, behavior: "instant" }); }
    } else if (movement < 0 && y >= next - 2 && y <= next + 2) {
      consume(event, nextScene, rail, "wipe", -1, railEnd, () => top(nextScene));
    } else if (movement < 0 && y > next && y + movement < next) {
      event.preventDefault();
      win.scrollTo({ top: next, behavior: "instant" });
    }
  };
  // 滚动处理器兜底:某些滚动没有可取消的 wheel 事件(如触控板惯性/滚动条拖动),
  // 这里比较前后位置来识别"跨过了边界"并补触发转场;转场中则把页面钉在锁定位置。
  const onScroll = () => {
    const y = win.scrollY, before = previousY;
    previousY = y;
    if (running && Math.abs(win.scrollY - lockedY) > 2 && !root.classList.contains("is-notice-open")) {
      previousY = lockedY;
      win.scrollTo({ top: lockedY, behavior: "instant" });
      return;
    }
    if (running || nativeNavigation || !allowed() || rail.dataset.railMode !== "scroll"
      || root.classList.contains("is-lumenkaelxystus-hero-locked")) return;
    const start = railStart(), end = railEnd(), next = top(nextScene);
    // Actual browser displacement can exceed a wheel delta or arrive without a cancelable wheel.
    // 浏览器实际滚动位移可能大于滚轮增量,或压根没有可拦截的 wheel,所以才用位置比较来兜底。
    if (before >= next - 2 && y < next - 2) {
      coverRailBoundary(-1);
    } else if (heroReady && y > 2 && ((before <= 2) || (y < start - 2 && y >= before))) {
      coverHeroBoundary(1);
    } else if (y < start - 2 && y >= 0 && ((before >= start - 2) || (y > 2 && y < before))) {
      coverHeroBoundary(-1);
    } else if (y > end + 2 && ((before <= end + 2 && before >= start - 2) || (y < next - 2 && y >= before))) {
      coverRailBoundary(1);
    } else if (y < next - 2 && y >= start - 2 && ((before >= next - 2) || (y > end + 2 && y < before))) {
      coverRailBoundary(-1);
    }
  };
  // 发生明确的"跳转类"操作(键盘导航、点链接、hash 变化)时,
  // 标记为原生导航并取消转场,把滚动控制权还给浏览器。
  const navigate = () => {
    nativeNavigation = true;
    previousY = win.scrollY;
    cancel();
  };
  // wheel 用 passive:false 才能 preventDefault 接管滚动;其余只读监听用 passive:true。
  // 窗口尺寸变化、偏好变化、页面隐藏都会取消当前转场。
  listen(win, "wheel", onWheel, { passive: false });
  listen(win, "scroll", onScroll, { passive: true });
  listen(win, "resize", cancel, { passive: true });
  listen(win, "pagehide", cancel);
  listen(win, "hashchange", navigate);
  listen(reduced, "change", cancel);
  listen(fine, "change", cancel);
  listen(doc, "visibilitychange", () => { if (doc.hidden) cancel(); });
  listen(doc, "keydown", event => {
    if (["Tab", "Escape", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", " "].includes(event.key)) navigate();
  });
  // click 用捕获阶段(true)监听,确保点链接/弹层按钮时先于目标元素处理并取消转场。
  listen(doc, "click", event => {
    if (event.target?.closest?.("a[href], [data-notice-open]")) navigate();
  }, true);
  listen(doc, "focusin", navigate);
  // 返回给首页组件的控制接口;setHeroReady 把布尔值转成布尔再存档。
  return {
    enterContents,
    setHeroReady(value) { heroReady = Boolean(value); },
    isRunning: () => running,
    // 卸载:标记销毁、取消转场、移除所有监听、从 DOM 中删掉动态创建的遮罩层。
    cleanup() {
      disposed = true;
      cancel();
      removers.splice(0).forEach(remove => remove());
      screen.remove();
    },
  };
}
