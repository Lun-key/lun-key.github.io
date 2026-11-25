/**
 * 【文件头】Live2D 角色交互脚本,只在浏览器端运行,被头像/Live2D 组件 import。
 * 它让角色的眼睛跟随鼠标、定时眨眼、被点击/悬停时做表情反应;
 * 通过"改写" Cubism SDK 模型更新函数把参数注入渲染流程。
 * 改本文件会影响:角色视线跟随、眨眼、点击/待机表情,以及原生输入的接管与还原。
 */
const clamp = (value, min, max) => Math.min(max, Math.max(min, value)); // 把数值限制在 [min, max]
// smoothstep:把 0~1 的值做平滑曲线映射(两端变化慢、中间快),让缓动更自然。
const smoothstep = (value) => {
  const p = clamp(value, 0, 1);
  return p * p * (3 - 2 * p);
};
//  ADSR 包络:根据已经过去的时间 elapsed,算出"当前强度"。
//  分三段:attack 渐强 → hold 保持 → release 渐弱,用来做眨眼/微笑这类有起落的表情。
const envelope = (elapsed, attack, hold, release) => {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  if (elapsed < attack) return smoothstep(elapsed / attack);
  if (elapsed < attack + hold) return 1;
  return 1 - smoothstep((elapsed - attack - hold) / release);
};

/**
 * 把鼠标/触摸事件的屏幕坐标换算成角色视线的归一化目标(-1~1)。
 * 以画面里"脸"的位置为锚点,并用 tanh 做压缩,避免指针离得远时眼珠转过头。
 * @param {PointerEvent} event 指针事件(需要 clientX/clientY);传 null 返回中心
 * @param {HTMLCanvasElement} canvas Live2D 画布,用来取位置和尺寸
 * @returns {{x: number, y: number}} 视线目标 x/y
 */
export function live2dGazeTarget(event, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect?.width || !rect.height || !Number.isFinite(event?.clientX)
    || !Number.isFinite(event?.clientY)) return { x: 0, y: 0 };
  // The model's face sits left of the canvas center. Using that visual anchor keeps
  // the eyes responsive while the pointer is actually over the character.
  const x = (event.clientX - rect.left - rect.width * 0.36) / Math.max(140, rect.width * 0.56);
  const y = (rect.top + rect.height * 0.2 - event.clientY) / Math.max(120, rect.height * 0.46);
  const length = Math.hypot(x, y);
  const scale = length > 0 ? Math.tanh(length * 1.15) / length : 1;
  return { x: x * scale, y: y * scale };
}

// 从 Cubism 模型里取出参数列表,并返回两个操作参数的工具:
// set 直接设为目标值(自动限制在模型允许的范围内),blend 按比例平滑靠近目标值。
function parameters(model) {
  const ids = model?.getModel?.()?.parameters?.ids;
  if (!ids) return null;
  const set = (id, value) => {
    const i = ids.indexOf(id);
    if (i >= 0) model.setParameterValueByIndex(i, clamp(value,
      model.getParameterMinimumValue(i), model.getParameterMaximumValue(i)));
  };
  const blend = (id, target, amount) => {
    const i = ids.indexOf(id);
    if (i < 0 || amount <= 0) return;
    const current = model.getParameterValueByIndex(i);
    set(id, current + (target - current) * clamp(amount, 0, 1));
  };
  return { set, blend };
}

// 应用头部/身体/眼球姿态:全部用"绝对目标值"设置,避免逐帧累加导致漂移;
// 开启减少动效时,把头部相关角度直接归零,只保留必要的眼球跟踪。
function applyPose(model, reaction, now, reducedMotion) {
  const p = parameters(model);
  if (!p) return;
  const gaze = reaction.gaze ?? { headX: 0, headY: 0, eyeX: 0, eyeY: 0 };
  const elapsed = now - reaction.startedAt;
  const tap = reaction.kind === "tap";
  const expressive = tap || reaction.kind === "idle-smile" || reaction.kind === "idle-curious";
  const intensity = expressive ? envelope(elapsed, 180, tap ? 450 : 360, 520) : 0;
  const wink = tap ? envelope(elapsed - 60, 100, 260, 260) : 0;
  // Absolute targets avoid accumulating last frame's pose or compounding XY into roll.
  p.set("ParamAngleX", reducedMotion ? 0 : gaze.headX * 8);
  p.set("ParamAngleY", reducedMotion ? 0 : gaze.headY * 5.5);
  p.set("ParamAngleZ", reducedMotion ? 0 : (reaction.eyes === "left" ? -1 : 1) * intensity * 1.2);
  p.set("ParamBodyAngleX", reducedMotion ? 0 : gaze.headX * 0.9);
  p.set("ParamEyeBallX", gaze.eyeX * 0.45 * (1 - wink * 0.65));
  p.set("ParamEyeBallY", gaze.eyeY * 0.34 * (1 - wink * 0.65));
}

/**
 * 把当前反应状态(reaction)写成模型表情参数:微笑、好奇、眨眼、张嘴等。
 * 在 applyPose 的姿态基础上叠加表情;blend 负责平滑过渡,不破坏模型的眨眼基线。
 * @param {object} model Cubism 外层模型对象
 * @param {object} reaction 当前反应状态(见 createLive2dReactions 内的 reaction)
 * @param {number} now 当前时间戳(performance.now())
 * @param {boolean} reducedMotion 是否开启了减少动效
 */
export function applyLive2dExpression(model, reaction, now, reducedMotion = false) {
  const p = parameters(model);
  if (!p) return;
  applyPose(model, reaction, now, reducedMotion);
  const { blend } = p;
  const elapsed = now - reaction.startedAt;
  const tap = reaction.kind === "tap";
  const smile = tap || reaction.kind === "idle-smile"
    ? envelope(elapsed, 180, tap ? 450 : 360, 520) : 0;
  const curious = reaction.kind === "idle-curious" ? envelope(elapsed, 220, 320, 500) : 0;
  const hover = reaction.hover ?? 0;
  const wink = tap ? envelope(elapsed - 60, 100, 260, 260) : 0;
  const blink = envelope(now - reaction.blinkAt, 70, 35, 130);
  // Chieri's neutral smile-eye value is 0.5. Preserve the open eye and runtime blink baseline.
  // 取几种情绪里最强的作为"暖意"强度,驱动眯眼笑;保持睁眼与运行时眨眼的基线不被覆盖。
  const warmth = Math.max(hover * 0.35, smile * 0.65, curious * 0.18);
  blend("ParamEyeLSmile", 0.2, warmth);
  blend("ParamEyeRSmile", 0.2, warmth);
  // RUKI 提供眉毛、嘴型和左右眼开合参数；眼型反馈叠加在眨眼与睁眼基线上。
  blend("ParamMouthForm", -0.6, Math.max(hover * 0.45, smile, curious * 0.15));
  blend("ParamMouthOpenY", 0.42, tap ? envelope(elapsed - 180, 150, 160, 330) : curious * 0.4);
  blend("ParamBrowLY", 0.12, Math.max(smile, curious));
  blend("ParamBrowRY", 0.12, Math.max(smile, curious));
  for (const [side, eye] of [["left", "L"], ["right", "R"]]) {
    const closure = Math.max(blink, reaction.eyes === side ? wink : 0);
    blend("ParamEye" + eye + "Open", 0, closure);
    if (tap && reaction.eyes === side) blend("ParamEye" + eye + "Smile", 0.08, wink);
  }
}

/**
 * 创建一整套 Live2D 反应控制器:接管原生输入、监听指针事件、驱动视线/表情/眨眼。
 * 返回的控制器有 start(root, canvas) 开始、stop() 暂停、destroy() 彻底销毁三个方法。
 * @param {Function} AppDelegate Cubism SDK 应用代理类,会被 patch 它的 run 方法以拿到模型和输入监听
 * @param {Document} doc 目标 document
 * @param {Window} win 目标 window
 * @param {Function} random 随机函数,默认 Math.random(便于测试注入)
 * @returns {{start: Function, stop: Function, destroy: Function}} 控制器
 */
export function createLive2dReactions(AppDelegate, doc = document, win = window, random = Math.random) {
  let delegate = null, root = null, canvas = null, attachedModel = null;
  let restoreModel = () => {}, restoreInput = () => {};
  let modelTimer = 0, idleTimer = 0, press = null, pointer = null, hovering = false;
  let lastFrame = 0, nextBlink = Infinity, taps = 0;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reaction = {
    hover: 0, kind: null, startedAt: -Infinity, blinkAt: -Infinity, eyes: "both",
    gaze: { headX: 0, headY: 0, eyeX: 0, eyeY: 0 }
  };
  // 角色当前是否"在场":已挂载、未被隐藏、页面可见时才驱动表情。
  const active = () => root && !root.classList.contains("waifu-hidden") && !doc.hidden;
  // 定时(9~18 秒随机)触发一次待机表情(微笑或好奇),减少动效时不安排。
  const scheduleIdle = () => {
    win.clearTimeout(idleTimer);
    if (!active() || reducedMotion?.matches) return;
    idleTimer = win.setTimeout(() => {
      if (active() && !hovering && !press) {
        reaction.kind = random() < 0.65 ? "idle-smile" : "idle-curious";
        reaction.startedAt = win.performance.now();
        reaction.eyes = "both";
      }
      scheduleIdle();
    }, 9000 + random() * 9000);
  };
  const resetAttention = () => {
    pointer = null;
    press = null;
    hovering = false;
  };
  // 每帧更新:用指数平滑(1 - e^(-dt/τ))让视线和悬停强度平滑趋近目标,
  // dt 封顶 100ms 防止切回标签页时跳变;到点则安排一次眨眼。返回当前时间戳。
  const tick = () => {
    const now = win.performance.now();
    const dt = clamp(now - lastFrame, 0, 100);
    lastFrame = now;
    const target = live2dGazeTarget(press ? null : pointer, canvas);
    for (const [name, axis, ms] of [["headX", "x", 180], ["headY", "y", 210],
      ["eyeX", "x", 72], ["eyeY", "y", 92]]) {
      reaction.gaze[name] += (target[axis] - reaction.gaze[name]) * (1 - Math.exp(-dt / ms));
    }
    reaction.hover += ((hovering && !press?.dragged ? 1 : 0) - reaction.hover) * (1 - Math.exp(-dt / 180));
    if (!reducedMotion?.matches && now >= nextBlink && now - reaction.startedAt > 1500) {
      reaction.blinkAt = now;
      nextBlink = now + 3200 + random() * 2600;
    }
    return now;
  };
  // 从 SDK 代理深处挖出第一个 Live2D 模型。
  const getModel = () => delegate?.subdelegates?.at(0)?.getLive2DManager()?._models?.at(0);
  // 把我们用"包装函数"注入到模型的 update/doDraw/物理计算里,从而在每帧前后写入表情参数;
  // 同时保存原函数,便于还原(restoreModel)。找不到参数列表就反复重试。
  const attachModel = () => {
    const outer = getModel();
    const model = outer?.getModel?.();
    // LAppModel -> CubismModel -> Core.Model: only the last object exposes .parameters.
    if (!model?.getModel?.()?.parameters?.ids || outer === attachedModel) return;
    restoreModel();
    attachedModel = outer;
    const originalOuterUpdate = outer.update;
    const originalModelUpdate = model.update;
    const originalDraw = outer.doDraw;
    const drawnRoot = root;
    const draw = function (...args) {
      const result = originalDraw.apply(this, args);
      if (root === drawnRoot && active() && !root.classList.contains("waifu-render-ready")) {
        root.classList.add("waifu-render-ready");
      }
      return result;
    };
    const physics = outer._physics;
    const originalPhysics = physics?.evaluate;
    let now = win.performance.now();
    const physicsUpdate = function (...args) {
      if (active()) applyPose(model, reaction, now, reducedMotion?.matches);
      return originalPhysics.apply(this, args);
    };
    // Compose before the sole Core update so drawable flags and rendering stay in SDK order.
    // 在 Core 更新之前合成表情,保证可绘制标志和渲染仍按 SDK 的顺序进行。
    const beforeMesh = function (...args) {
      if (active()) applyLive2dExpression(model, reaction, now, reducedMotion?.matches);
      return originalModelUpdate.apply(this, args);
    };
    const update = function (...args) {
      if (active()) now = tick();
      return originalOuterUpdate.apply(this, args);
    };
    outer.update = update;
    model.update = beforeMesh;
    if (typeof originalDraw === "function") outer.doDraw = draw;
    else root?.classList.add("waifu-render-ready");
    if (originalPhysics) physics.evaluate = physicsUpdate;
    delegate.subdelegates.at(0).getLive2DManager().onDrag?.(0, 0);
    restoreModel = () => {
      if (outer.update === update) outer.update = originalOuterUpdate;
      if (model.update === beforeMesh) model.update = originalModelUpdate;
      if (outer.doDraw === draw) outer.doDraw = originalDraw;
      if (originalPhysics && physics.evaluate === physicsUpdate) physics.evaluate = originalPhysics;
      attachedModel = null;
      restoreModel = () => {};
    };
  };
  // 轮询找模型:没挂上时每 120ms 重试,挂上后降到每 1000ms 检查一次(模型可能被替换)。
  const findModel = () => {
    win.clearTimeout(modelTimer);
    if (!root || !delegate) return;
    attachModel();
    modelTimer = win.setTimeout(findModel, attachedModel ? 1000 : 120);
  };
  // 接管输入:移除 SDK 自带的鼠标移动/移出/点击监听,改由本模块统一处理视线与点击;
  // restoreInput 负责在销毁时把这些原生监听装回去。
  const takeInput = () => {
    restoreInput();
    const owner = delegate;
    const entries = [["mousemove", "mouseMoveEventListener"],
      ["mouseout", "mouseEndedEventListener"], ["pointerdown", "tapEventListener"]]
      .map(([name, key]) => [name, key, owner[key]]);
    for (const [name, , listener] of entries) if (listener) doc.removeEventListener(name, listener);
    restoreInput = () => {
      for (const [name, key, listener] of entries) {
        if (listener && owner[key] === listener) doc.addEventListener(name, listener, { passive: true });
      }
      restoreInput = () => {};
    };
  };
  // Monkey patch:改写 AppDelegate.prototype.run,在 SDK 启动时拿到代理实例(this),
  // 随即接管输入並開始找模型,然後再調用原 run 保證 SDK 正常運行。
  const originalRun = AppDelegate.prototype.run;
  const onRun = function (...args) {
    delegate = this;
    takeInput();
    findModel();
    return originalRun.apply(this, args);
  };
  AppDelegate.prototype.run = onRun;

  // 指针移动:移动超过 8px 视为拖动(不算点击);鼠标/触控笔才更新视线,触摸只用于拖动。
  const onMove = (event) => {
    if (!active()) return;
    if (press && event.pointerId === press.id
      && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.dragged = true;
    if (!event.pointerType || ["mouse", "pen"].includes(event.pointerType)) {
      pointer = { clientX: event.clientX, clientY: event.clientY };
    }
  };
  // 进入画布:标记为悬停(忽略触摸);离开则取消。鼠标移出整个文档时彻底清空注意力。
  const onEnter = (event) => {
    if (event.pointerType === "touch") return;
    hovering = true;
    onMove(event);
  };
  const onLeave = () => { hovering = false; };
  const onOut = (event) => { if (!event.relatedTarget) resetAttention(); };
  const onDown = (event) => {
    if (!active() || event.target !== canvas || event.button !== 0 || !event.isPrimary) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    scheduleIdle();
  };
  // 抬起:若没被判定为拖动且角色仍在场,则算作一次"点击",触发 tap 表情并左右眼交替眨眼。
  const onUp = (event) => {
    if (!press || event.pointerId !== press.id) return;
    const dragged = press.dragged || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8;
    press = null;
    if (dragged || !active()) return;
    reaction.kind = "tap";
    reaction.startedAt = win.performance.now();
    reaction.eyes = ++taps % 2 ? "right" : "left";
    scheduleIdle();
  };
  const onVisibility = () => {
    resetAttention();
    if (active()) {
      nextBlink = win.performance.now() + 3200;
      scheduleIdle();
    } else win.clearTimeout(idleTimer);
  };
  return {
    /** 启动:先 stop 清理旧状态,再注册所有指针/可见性监听,启动找模型与待机表情定时。 */
    start(nextRoot, nextCanvas) {
      this.stop();
      root = nextRoot;
      canvas = nextCanvas;
      root?.classList.add("waifu-awaiting-render");
      lastFrame = win.performance.now();
      nextBlink = lastFrame + 3200 + random() * 2600;
      doc.addEventListener("pointermove", onMove, { capture: true, passive: true });
      doc.addEventListener("pointerup", onUp, { capture: true });
      doc.addEventListener("pointercancel", resetAttention, { capture: true });
      doc.addEventListener("mouseout", onOut);
      doc.addEventListener("visibilitychange", onVisibility);
      win.addEventListener("blur", resetAttention);
      reducedMotion?.addEventListener?.("change", onVisibility);
      canvas?.addEventListener("pointerenter", onEnter);
      canvas?.addEventListener("pointerleave", onLeave);
      root?.addEventListener("pointerdown", onDown);
      findModel();
      scheduleIdle();
    },
    /** 暂停:移除全部监听、清定时器、还原模型注入函数,并把反应状态归零。 */
    stop() {
      win.clearTimeout(idleTimer);
      win.clearTimeout(modelTimer);
      doc.removeEventListener("pointermove", onMove, { capture: true });
      doc.removeEventListener("pointerup", onUp, { capture: true });
      doc.removeEventListener("pointercancel", resetAttention, { capture: true });
      doc.removeEventListener("mouseout", onOut);
      doc.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener("blur", resetAttention);
      reducedMotion?.removeEventListener?.("change", onVisibility);
      canvas?.removeEventListener("pointerenter", onEnter);
      canvas?.removeEventListener("pointerleave", onLeave);
      root?.removeEventListener("pointerdown", onDown);
      restoreModel();
      root = null;
      canvas = null;
      resetAttention();
      reaction.hover = 0;
      reaction.kind = null;
      reaction.startedAt = reaction.blinkAt = -Infinity;
      for (const key of Object.keys(reaction.gaze)) reaction.gaze[key] = 0;
    },
    /** 彻底销毁:在 stop 基础上还原被接管的原生输入和 AppDelegate.run,清空引用。 */
    destroy() {
      const previousRoot = root;
      this.stop();
      previousRoot?.classList.remove("waifu-awaiting-render");
      restoreInput();
      if (AppDelegate.prototype.run === onRun) AppDelegate.prototype.run = originalRun;
      delegate = null;
    }
  };
}
