/**
 * 【文件头】Live2D 看板娘(waifu)的定位/拖拽脚本,只在浏览器端运行,被头像组件 import。
 * 把角色容器挪到 body 下、用 CSS translate 定位,支持鼠标拖拽,并限制在视口内。
 * 改本文件会影响:角色能否拖动、窗口缩放/失焦/页面隐藏时的位置复位。
 */
/**
 * 把角色左上角坐标限制在视口内,四周保留 margin 像素边距,避免被拖出屏幕。
 * @param {number} left 期望的横向坐标
 * @param {number} top 期望的纵向坐标
 * @param {number} width 角色宽度
 * @param {number} height 角色高度
 * @param {number} viewportWidth 视口宽度
 * @param {number} viewportHeight 视口高度
 * @returns {{left: number, top: number}} 限制后的合法坐标
 */
export function clampWaifuPosition(left, top, width, height, viewportWidth, viewportHeight) {
  const margin = 8;
  // 上限再留 margin:保证角色右下角也不越界;下限也是 margin。
  const clamp = (value, maximum) => Math.min(Math.max(margin, maximum - margin), Math.max(margin, value));
  return {
    left: clamp(left, viewportWidth - width),
    top: clamp(top, viewportHeight - height)
  };
}

/**
 * 挂载看板娘定位与拖拽。
 * @param {Element} root 角色容器
 * @param {Window} win 目标 window,默认当前窗口
 * @returns {Function} 清理函数:结束拖拽、移除全部监听
 */
export function mountWaifuAnchor(root, win = window) {
  const doc = root.ownerDocument;
  // 把角色挪到 body 直系子节点,避免受父级定位/overflow 影响拖拽定位。
  if (root.parentElement !== doc.body) doc.body.appendChild(root);
  // Ignore old library drag coordinates; start from the theme's viewport anchor.
  for (const property of ["top", "bottom", "left", "right", "translate"]) root.style.removeProperty(property);
  // x/y 是相对父级的位移(通过 CSS translate 应用);drag 记录当前拖拽的指针与偏移。
  let x = 0, y = 0, drag = null;
  // 把角色移到视口坐标 (left, top):先减去当前位移得到"原始位置",
  // 再用 clampWaifuPosition 限制边界,反推出新的 x/y 位移写入 translate。
  const moveTo = (left, top) => {
    const rect = root.getBoundingClientRect();
    const origin = { left: rect.left - x, top: rect.top - y };
    const next = clampWaifuPosition(left, top, rect.width, rect.height, win.innerWidth, win.innerHeight);
    x = next.left - origin.left;
    y = next.top - origin.top;
    root.style.translate = `${x}px ${y}px`;
  };
  // 结束拖拽:释放指针捕获、移除拖拽样式;带 event 时只响应同一个 pointerId。
  const stop = (event) => {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const pointerId = drag.id;
    drag = null;
    if (root.hasPointerCapture?.(pointerId)) root.releasePointerCapture(pointerId);
    root.classList.remove("is-waifu-dragging");
  };
  // 只在画布(id=live2d)上、鼠标左键、主指针时开始拖拽;记录指针与角色左上角的偏移。
  const down = (event) => {
    if (drag || event.button !== 0 || !event.isPrimary || event.target.id !== "live2d") return;
    const rect = root.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
    root.setPointerCapture?.(event.pointerId);
    root.classList.add("is-waifu-dragging");
  };
  const move = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    moveTo(event.clientX - drag.x, event.clientY - drag.y);
  };
  // 视口变化时把角色拉回可见范围;窗口失焦/页面隐藏则结束拖拽。
  const resize = () => {
    stop();
    if (root.classList.contains("waifu-hidden")) return;
    const rect = root.getBoundingClientRect();
    moveTo(rect.left, rect.top);
  };
  const visibility = () => { if (doc.visibilityState === "hidden") stop(); };
  // 注册拖拽指针事件与窗口级复位事件;最后立刻 resize 一次确保初始位置合法。
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", stop);
  root.addEventListener("pointercancel", stop);
  root.addEventListener("lostpointercapture", stop);
  win.addEventListener("resize", resize);
  win.addEventListener("blur", resize);
  doc.addEventListener("visibilitychange", visibility);
  resize();
  // 清理函数:结束拖拽并移除全部监听。
  return () => {
    stop();
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerup", stop);
    root.removeEventListener("pointercancel", stop);
    root.removeEventListener("lostpointercapture", stop);
    win.removeEventListener("resize", resize);
    win.removeEventListener("blur", resize);
    doc.removeEventListener("visibilitychange", visibility);
  };
}
