/**
 * 【文件头】首页漫画区的浏览器端运行时脚本,被首页漫画/图鉴相关组件 import。
 * 提供:弹簧物理视差(mountMangaScene)、横向章节轨道吸附(mountChapterRail)、
 * 图鉴 tab 切换(mountAlbum)、笔记分类筛选(mountArchive)。
 * 改本文件会影响:鼠标移动时前后层图片视差、章节切换、图鉴/归档按钮的显隐。
 */
/**
 * 数值限制工具:把 value 压到 [min, max] 区间,供本文件各处复用。
 */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 弹簧物理单步计算:让 position 在 velocity 驱动下朝 target 逼近(带轻微阻尼)。
 * 用一个"弹簧-阻尼"模型,让视差跟随有顺滑的回弹手感,而不是硬跟随鼠标。
 * @param {number} position 当前位置
 * @param {number} velocity 当前速度
 * @param {number} target 目标位置
 * @param {number} seconds 距上一帧的时间(秒)
 * @returns {{position: number, velocity: number}} 更新后的位置与速度(位置限制在 ±1.08)
 */
export function springStep(position, velocity, target, seconds) {
  const dt = clamp(seconds, 0, 1 / 30); // 单帧时间封顶,防止切回标签页时步长过大
  // Fixed substeps keep the spring stable after a slow frame or interrupted input.
  // 把一大步拆成多个固定小步,慢帧或输入被打断时弹簧依然稳定。
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < steps; i++) {
    velocity += ((target - position) * 100 - velocity * 10) * dt / steps;
    position += velocity * dt / steps;
  }
  return { position: clamp(position, -1.08, 1.08), velocity };
}

/**
 * 根据指针位置(x, y,均为 -1~1)和滚动进度,计算前后两层的位移偏移。
 * 前层位移幅度更大、方向与后层相反,从而产生"近大远小"的视差纵深感。
 * @param {number} x 指针横向归一化位置(-1 左 ~ 1 右)
 * @param {number} y 指针纵向归一化位置
 * @param {number} scroll 滚动进度(0~1),默认 0
 * @returns {{back: {x: number, y: number}, front: {x: number, y: number}}} 两层各自的 x/y 像素偏移
 */
export function layerOffsets(x, y, scroll = 0) {
  return {
    back: { x: -clamp(x, -1.08, 1.08) * 4, y: -clamp(y, -1.08, 1.08) * 3 - clamp(scroll, 0, 1) * 5 },
    front: { x: clamp(x, -1.08, 1.08) * 9, y: clamp(y, -1.08, 1.08) * 6 + clamp(scroll, 0, 1) * 8 }
  };
}

/**
 * 挂载漫画视差场景:鼠标在图上移动时,前后两层图片按弹簧动画产生纵深视差。
 * 只在图片加载完成、元素可见、设备为精确指针且用户未要求减少动效时才运行;
 * 用 requestAnimationFrame 驱动,静止后自动停下以省性能。
 * @param {Element} root 漫画场景容器
 * @param {Window} win 目标 window,默认当前窗口
 * @param {Document} doc 目标 document,默认当前文档
 * @returns {Function} 清理函数:停止动画、断开 observer、移除监听
 */
export function mountMangaScene(root, win = window, doc = document) {
  const front = root.querySelector("[data-manga-front]");
  const back = root.querySelector("[data-manga-back]");
  const surface = root.parentElement ?? root;
  if (!front || !back) return () => {};
  // matchMedia 读取系统偏好:reduced 判断"减少动效",pointer 判断是否有精确指针(鼠标)。
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = win.matchMedia("(hover: hover) and (pointer: fine)");
  const removers = []; // 收集移除监听的函数,便于统一清理
  let disposed = false, loaded = false, visible = true, raf = 0, last = 0;
  let targetX = 0, targetY = 0, x = 0, y = 0, vx = 0, vy = 0;
  let rect = { left: 0, top: 0, width: 1, height: 1 }, documentTop = 0;
  // 注册监听的同时把对应的卸载函数存起来,避免清理时漏掉。
  const listen = (node, event, callback, options) => {
    node.addEventListener(event, callback, options);
    removers.push(() => node.removeEventListener(event, callback, options));
  };
  // 视差运行的前置条件:已加载、未销毁、可见、页面未隐藏、未减少动效、
  // 是精确指针、性能模式不是 lite、用户未开启省流量。任一不满足就停。
  const allowed = () => loaded && !disposed && visible && !doc.hidden && !reduced.matches && pointer.matches
    && doc.documentElement.dataset.lunkeyPerformance !== "lite" && !win.navigator?.connection?.saveData;
  // 把两层偏移量写成 transform,translate3d 可触发 GPU 合成,动画更流畅。
  const paint = () => {
    const scroll = clamp((win.scrollY - documentTop) / Math.max(rect.height, 1), 0, 1);
    const offsets = layerOffsets(x, y, scroll);
    for (const [image, offset] of [[front, offsets.front], [back, offsets.back]]) {
      image.style.transform = `translate3d(${offset.x.toFixed(3)}px, ${offset.y.toFixed(3)}px, 0)`;
    }
  };
  const stop = (reset = false) => {
    win.cancelAnimationFrame(raf);
    raf = 0; last = 0;
    if (reset) {
      x = y = vx = vy = targetX = targetY = 0;
      front.style.transform = back.style.transform = "";
    }
  };
  // requestAnimationFrame 动画循环:每帧推进弹簧,重绘,直到位移和速度都足够小才停。
  const frame = (now) => {
    raf = 0;
    if (!allowed()) { stop(true); return; }
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    ({ position: x, velocity: vx } = springStep(x, vx, targetX, dt));
    ({ position: y, velocity: vy } = springStep(y, vy, targetY, dt));
    paint();
    if (Math.abs(x - targetX) + Math.abs(y - targetY) + Math.abs(vx) + Math.abs(vy) > .002) {
      raf = win.requestAnimationFrame(frame);
    } else {
      x = targetX; y = targetY; vx = vy = 0; last = 0; paint();
    }
  };
  // 唤醒动画:条件允许且当前没有待执行帧时才排一帧,避免重复排帧。
  const wake = () => { if (allowed() && !raf) raf = win.requestAnimationFrame(frame); };
  // 重新测量元素在页面中的位置与尺寸,指针坐标换算要用到。
  const measure = () => {
    rect = root.getBoundingClientRect();
    documentTop = rect.top + win.scrollY;
    wake();
  };
  const changeMode = () => { if (!allowed()) stop(true); else { measure(); wake(); } };
  listen(surface, "pointermove", (event) => {
    if (!allowed() || event.pointerType === "touch") return;
    targetX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1, -1, 1);
    targetY = clamp((event.clientY - (documentTop - win.scrollY)) / Math.max(rect.height, 1) * 2 - 1, -1, 1);
    wake();
  }, { passive: true });
  listen(surface, "pointerleave", () => { targetX = targetY = 0; wake(); });
  listen(win, "scroll", wake, { passive: true });
  listen(win, "resize", measure, { passive: true });
  listen(doc, "visibilitychange", changeMode);
  listen(reduced, "change", changeMode);
  listen(pointer, "change", changeMode);
  listen(win, "pagehide", () => stop(true));
  listen(win, "pageshow", changeMode);
  // IntersectionObserver 在元素进入/离开视口时回调;离开时停动画,进入时恢复,省性能。
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    changeMode();
  }, { threshold: 0 }) : null;
  observer?.observe(root);
  // 等待图片真正解码完成(而不只是下载完),避免动画作用在空图上。
  const decode = (image) => {
    if (typeof image.decode === "function") return image.decode().then(() => {
      if (!image.naturalWidth) throw new Error("Empty image");
    });
    if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error("Image unavailable"));
    return new Promise((resolve, reject) => {
      listen(image, "load", resolve, { once: true });
      listen(image, "error", reject, { once: true });
    });
  };
  // 两张图都解码成功后才标记为就绪并启动;失败则标记 ready=false 并复位。
  Promise.all([decode(front), decode(back)]).then(() => {
    if (disposed || !root.isConnected) return;
    loaded = true;
    root.dataset.ready = "true"; // dataset.ready 会被 CSS/组件用来决定显隐
    measure();
  }).catch(() => {
    if (!disposed) { root.dataset.ready = "false"; stop(true); }
  });
  measure();
  // 清理函数:停止动画、断开 observer、执行所有移除监听函数。
  return () => {
    disposed = true;
    stop(true);
    observer?.disconnect();
    removers.splice(0).forEach((remove) => remove());
  };
}

/**
 * 找出距离当前滚动位置 left 最近的章节下标,用于高亮当前章节。
 * @param {number[]} offsets 每个章节对应的目标滚动位置数组
 * @param {number} left 当前滚动位置
 * @returns {number} 距离最近的章节下标
 */
export function nearestRailIndex(offsets, left) {
  return offsets.reduce((best, offset, i) => Math.abs(offset - left) < Math.abs(offsets[best] - left) ? i : best, 0);
}

/**
 * 挂载横向章节轨道:桌面端把"页面纵向滚动"映射成"章节横向移动"并吸附,
 * 同时高亮当前章节、更新进度条。移动端或偏好减少动效时退回原生横向滚动。
 * @param {Element} root 章节轨道容器
 * @param {Window} win 目标 window,默认当前窗口
 * @returns {Function} 清理函数:取消帧、移除监听、复位样式
 */
export function mountChapterRail(root, win = window) {
  const stage = root.querySelector(".chapter-rail-stage");
  const track = root.querySelector("[data-rail-track]");
  const items = [...root.querySelectorAll(".chapter-leaf")];
  const position = root.querySelector("[data-rail-position]");
  const progress = root.querySelector("[data-rail-progress]");
  if (!stage || !track || !items.length) return () => {};
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  let frame = 0, scrollMode = false, travel = 0, active = -1;
  // 计算每个章节"居中"时应滚动到的位置;首尾固定为 0 和 travel,中间按元素中心算。
  const offsets = () => items.map((item, index) => index === 0 ? 0 : index === items.length - 1 ? travel
    : clamp(item.offsetLeft + item.offsetWidth / 2 - stage.clientWidth / 2, 0, travel));
  const top = () => root.getBoundingClientRect().top + win.scrollY;
  // 高亮指定章节:给当前项加 data-rail-active,并更新"01 / 08"这类位置文本。
  const select = (index) => {
    if (active === index) return;
    active = index;
    items.forEach((item, i) => {
      if (i === index) item.setAttribute("data-rail-active", "true");
      else item.removeAttribute("data-rail-active");
    });
    if (position) position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  };
  // scrollMode 用页面滚动位置驱动轨道位移,否则用轨道自身的 scrollLeft;再更新进度与高亮。
  const update = () => {
    frame = 0;
    const left = clamp(scrollMode ? win.scrollY - top() : track.scrollLeft, 0, travel);
    if (scrollMode) track.style.transform = `translate3d(${-left.toFixed(1)}px, 0, 0)`;
    if (progress) progress.style.transform = `scaleX(${travel ? left / travel : 0})`;
    select(left <= 1 ? 0 : left >= travel - 1 ? items.length - 1 : nearestRailIndex(offsets(), left));
  };
  // rAF 节流:一帧最多更新一次。
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  // 测算是否启用滚动吸附模式,并写入 --rail-runway CSS 变量撑出滚动空间。
  const measure = () => {
    const enabled = fine.matches && !reduced.matches && items.length > 1;
    root.dataset.railMode = enabled ? "scroll" : "native";
    scrollMode = enabled;
    travel = Math.max(0, track.scrollWidth - stage.clientWidth);
    if (enabled) {
      if (travel > 2) {
        const runway = `${stage.clientHeight + travel}px`;
        if (root.style.getPropertyValue("--rail-runway") !== runway) root.style.setProperty("--rail-runway", runway);
      } else {
        scrollMode = false;
        root.dataset.railMode = "native";
      }
    }
    track.tabIndex = scrollMode ? -1 : 0;
    if (!scrollMode) {
      root.style.removeProperty("--rail-runway");
      track.style.transform = "";
      travel = Math.max(0, track.scrollWidth - stage.clientWidth);
    } else track.scrollLeft = 0;
    update();
  };
  // 键盘 Tab 聚焦到某章节时,把页面滚到能让它居中的位置(无障碍)。
  const focusIn = (event) => {
    const index = items.indexOf(event.target);
    if (index < 0 || !scrollMode) return;
    win.scrollTo({ top: top() + clamp(offsets()[index], 0, travel), behavior: "instant" });
    schedule();
  };
  const onScroll = () => { if (scrollMode) schedule(); };
  track.addEventListener("focusin", focusIn);
  track.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", measure, { passive: true });
  fine.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  measure();
  // 清理函数:取消帧、复位 CSS 变量与样式、移除全部监听。
  return () => {
    win.cancelAnimationFrame(frame);
    delete root.dataset.railMode;
    root.style.removeProperty("--rail-runway");
    if (progress) progress.style.transform = "";
    track.style.transform = "";
    track.tabIndex = 0;
    track.removeEventListener("focusin", focusIn);
    track.removeEventListener("scroll", schedule);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", measure);
    fine.removeEventListener("change", measure);
    reduced.removeEventListener("change", measure);
  };
}

/**
 * 挂载图鉴 tab:点击某个标签,用 aria-pressed 标记选中态,并只显示对应页面。
 * @param {Element} root 图鉴容器
 * @returns {Function} 清理函数:移除每个标签的点击监听
 */
export function mountAlbum(root) {
  const tabs = [...root.querySelectorAll("[data-album-tab]")];
  const pages = [...root.querySelectorAll("[data-album-page]")];
  const handlers = tabs.map((tab, index) => {
    const choose = () => {
      tabs.forEach((item, i) => item.setAttribute("aria-pressed", String(i === index)));
      pages.forEach((item, i) => { item.hidden = i !== index; });
    };
    tab.addEventListener("click", choose);
    return () => tab.removeEventListener("click", choose);
  });
  return () => handlers.forEach((remove) => remove());
}

/**
 * 挂载归档分类筛选:按类别显示/隐藏条目,并更新可见条目计数。
 * "all" 表示显示全部;aria-pressed 标记当前选中的分类。
 * @param {Element} root 归档容器
 * @returns {Function} 清理函数:移除每个分类标签的点击监听
 */
export function mountArchive(root) {
  const tabs = [...root.querySelectorAll("[data-archive-category]")];
  const entries = [...root.querySelectorAll("[data-entry-category]")];
  const count = root.querySelector("[data-archive-count]");
  const handlers = tabs.map((tab) => {
    const choose = () => {
      const category = tab.dataset.archiveCategory;
      let visible = 0;
      tabs.forEach((item) => item.setAttribute("aria-pressed", String(item === tab)));
      entries.forEach((entry) => {
        entry.hidden = category !== "all" && entry.dataset.entryCategory !== category;
        if (!entry.hidden) visible++;
      });
      if (count) count.textContent = `${visible} 篇笔记`;
    };
    tab.addEventListener("click", choose);
    return () => tab.removeEventListener("click", choose);
  });
  return () => handlers.forEach((remove) => remove());
}
