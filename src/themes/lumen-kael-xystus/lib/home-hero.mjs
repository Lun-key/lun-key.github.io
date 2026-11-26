/**
 * 【文件头】首页首屏(Hero)交互脚本,只在浏览器端运行。
 * 由首页的 Hero 组件 import 并调用 mountHomeHero() 后生效。
 * 负责:打字机文字、"滚轮下拉解锁首屏"手势、头像花朵拖拽、戳头像气泡,
 * 以及用键盘/焦点快速跳过首屏。改它会影响能否滚到正文,以及写在 .hero
 * 元素上的 --avatar-y、--avatar-scale、--profile-opacity 等 CSS 变量。
 */
/**
 * 挂载首屏交互(幂等:会先清掉上一次挂载留下的监听和定时器)。
 * @param {object|null} transitions 页面转场控制器(见 home-transitions.mjs),可为 null;
 *   这里用到它的 setHeroReady() 通知与 isRunning() 判断。
 * @returns {Function} 清理函数;同时挂在 window.__lunkeyHeroCleanup 上。
 */
export function mountHomeHero(transitions = null) {
    // 先执行上一次挂载留下的清理,避免重复挂载时事件监听和定时器叠加。
    window.__lunkeyHeroCleanup?.();
    // 把本模块所有"卸载时要做的事"统一放进这个数组。
    const heroCleanupTasks = [];
    window.__lunkeyHeroCleanup = () => {
      // splice(0) 取出并清空数组再逐个执行,保证每个清理任务只跑一次。
      heroCleanupTasks.splice(0).forEach((cleanup) => cleanup());
    };

    // 用 data-* 属性定位关键节点;可选链 ?. 在节点不存在时返回 undefined 而不报错。
    const stage = document.querySelector("[data-hero-stage]");
    const hero = stage?.querySelector(".hero");
    const typingTarget = document.querySelector("[data-terminal-typing]");
    const nameTarget = document.querySelector("[data-name-typing]");

    // 小工具:把数值限制在 [min, max] 区间,动画里到处用它防止越界。
    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const pullDistance = 260; // 下拉多少像素算"拉到底"
    const dockThreshold = 0.56; // 拉开超过这个比例才算停住,否则回弹
    const resetDelay = 260; // 停止滚动后多久判定手势结束(毫秒)
    // matchMedia 读取系统偏好:"减少动态效果"开启时延时设为 0,立即解锁不等动画。
    const releaseDelay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    const profileCard = hero?.querySelector(".identity-terminal");
    const scrollRoot = document.documentElement;
    const scrollLockClass = "is-lumenkaelxystus-hero-locked";
    const terminalLines = [
      "pin --dev-notes --anime-diary",
      "collect \"blue moments\" && write",
      "npm run scrapbook",
      "echo \"做自己想做，想自己所想\""
    ];
    const nameLines = ["lunkey", "lumen Kael Xystus"];

    let pull = 0;
    let reversePull = 0;
    let state = "idle";
    let resetTimer = 0;
    let releaseTimer = 0;
    let correctingScroll = false;
    const typingTimers = new Set();

    // 把每个打字机定时器登记到 Set,回调执行后移除;卸载时能一次性全清掉。
    const setTypingTimer = (callback, delay) => {
      const timer = window.setTimeout(() => {
        typingTimers.delete(timer);
        callback();
      }, delay);
      typingTimers.add(timer);
    };

    /**
     * 打字机循环:逐字写出 lines 里的句子,短暂停留后逐字擦除,再切下一句。
     * @param {Element} target 显示文字的节点,不存在则直接返回
     * @param {string[]} lines 要循环显示的句子
     * @param {number} writeDelay 每写一个字的间隔(毫秒)
     * @param {number} eraseDelay 每删一个字的间隔(毫秒)
     * @param {number} holdDelay 写完后停留多久才开始删(毫秒)
     */
    const runTypingLoop = (target, lines, writeDelay = 58, eraseDelay = 32, holdDelay = 1250) => {
      if (!target) return;

      let lineIndex = 0;
      let charIndex = 0;
      let deleting = false;

      const tick = () => {
        const line = lines[lineIndex];
        target.textContent = line.slice(0, charIndex);

        if (!deleting && charIndex < line.length) {
          charIndex += 1;
          setTypingTimer(tick, writeDelay);
          return;
        }

        if (!deleting && charIndex === line.length) {
          deleting = true;
          setTypingTimer(tick, holdDelay);
          return;
        }

        if (deleting && charIndex > 0) {
          charIndex -= 1;
          setTypingTimer(tick, eraseDelay);
          return;
        }

        deleting = false;
        lineIndex = (lineIndex + 1) % lines.length;
        setTypingTimer(tick, 360);
      };

      tick();
    };

    // 关闭浏览器默认的滚动位置恢复,改由本脚本控制首屏滚动(先判断兼容性)。
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    // 带 #hash 说明是页内跳转,不强制定位到顶部。
    const initialHash = location.hash;
    // requestAnimationFrame 让"滚到顶部"在下一帧执行,确保布局已完成;把帧 id 记下来便于取消。
    const initialScrollFrame = !initialHash
      ? requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }))
      : 0;
    heroCleanupTasks.push(() => cancelAnimationFrame(initialScrollFrame));

    // 通过给 <html> 加一个 CSS 类来锁住页面滚动(具体 overflow 规则写在样式表里)。
    const lockHeroScroll = () => {
      if (scrollRoot.classList.contains(scrollLockClass)) return; // 已锁定则不重复
      scrollRoot.classList.add(scrollLockClass);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    const unlockHeroScroll = () => scrollRoot.classList.remove(scrollLockClass);

    /**
     * 把 0~1 的进度换算成多个 CSS 变量写到 .hero 上,驱动头像位移/缩放、
     * 资料卡淡入、文案淡出等视觉变化。这是 JS 与 CSS 动画之间的桥梁。
     */
    const setProgress = (progress) => {
      if (!hero) return;

      const value = clamp(progress);
      if (value < 1) transitions?.setHeroReady(false); // 没到终点就通知转场模块"首屏未就绪"
      hero.style.setProperty("--avatar-y", `${(1 - value) * 56}vh`);
      hero.style.setProperty("--avatar-scale", `${0.78 + value * 0.22}`);
      hero.style.setProperty("--profile-opacity", `${clamp((value - 0.08) / 0.48)}`);
      hero.style.setProperty("--copy-opacity", `${1 - clamp((value - 0.12) / 0.42)}`);
      hero.style.setProperty("--cue-opacity", `${1 - clamp(value / 0.48)}`);
    };

    // 回弹:手势没到达阈值时,把进度清零、解锁滚动、移除动画类。
    const resetPull = () => {
      if (state === "passed") return; // 已放行就不再回退
      window.clearTimeout(resetTimer);
      window.clearTimeout(releaseTimer);
      pull = 0;
      reversePull = 0;
      state = "idle";
      unlockHeroScroll();
      hero?.classList.remove("is-docked", "is-pulling");
      setProgress(0);
    };

    // 手势结束时做判定:拉开超过阈值就停靠,否则回弹。
    const settlePull = () => {
      if (state !== "pulling") return;

      if (pull / pullDistance >= dockThreshold) {
        dockProfile();
      } else {
        resetPull();
      }
    };

    // 防抖式判定:每次滚动都推迟 settlePull,停下 resetDelay 毫秒后才真正判定。
    const schedulePullSettle = () => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(settlePull, resetDelay);
    };

    // 真正放行:标记已通过、通知转场模块,并解除滚动锁。
    const releaseScroll = () => {
      if (state !== "docked") return;
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
      state = "passed";
      transitions?.setHeroReady(true);
      if (scrollRoot.classList.contains(scrollLockClass) && window.scrollY > 2) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      unlockHeroScroll();
    };

    // transitionend 会在 CSS 过渡结束时触发,且子元素也会冒泡上来;
    // 这里只认资料卡本身的 transform 过渡,才能确定停靠动画真正播完。
    const handleProfileTransitionEnd = (event) => {
      if (event.target === profileCard && event.propertyName === "transform") {
        releaseScroll();
      }
    };

    // 停靠:锁定滚动、切到 docked 状态、把进度推满播放动画,
    // 再用 releaseDelay 定时在动画结束后自动放行。
    const dockProfile = () => {
      window.clearTimeout(resetTimer);
      lockHeroScroll();
      pull = pullDistance;
      reversePull = 0;
      state = "docked";
      hero?.classList.remove("is-pulling");
      hero?.classList.add("is-docked");
      setProgress(1);

      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(releaseScroll, releaseDelay);
    };

    /**
     * 首屏滚轮门槛的核心处理器,就是一个状态机:
     * idle(空闲) → pulling(下拉中) → docked(已停靠) → passed(已放行)。
     * deltaY > 0 表示向下滚;preventDefault() 拦住浏览器默认滚动,
     * 把滚轮"劫持"成下拉动画的进度。注册时用了 passive:false 才能阻止默认行为。
     */
    const handleHeroWheel = (event) => {
      if (!stage || !hero) return;
      if (document.documentElement.classList.contains("is-notice-open")) return; // 公告弹层打开时不接管
      if (event.defaultPrevented || transitions?.isRunning()) return;

      const stageRect = stage.getBoundingClientRect();
      const atHeroTop = window.scrollY <= 2 && stageRect.top >= -2;
      if (!atHeroTop) {
        if (state === "passed" || initialHash || stageRect.bottom <= 0) return;
        event.preventDefault();
      }

      if (event.deltaY < 0) {
        event.preventDefault();

        if (state === "passed" || state === "docked") {
          reversePull += -event.deltaY;
          if (reversePull < 36) return;
          window.clearTimeout(releaseTimer);
          pull = 0;
          reversePull = 0;
          state = "idle";
          unlockHeroScroll();
          hero.classList.remove("is-docked", "is-pulling");
          setProgress(0);
          return;
        }

        pull = clamp(pull + event.deltaY * 0.82, 0, pullDistance);
        state = pull > 0 ? "pulling" : "idle";
        if (state === "pulling") lockHeroScroll();
        else unlockHeroScroll();
        hero.classList.toggle("is-pulling", state === "pulling");
        hero.classList.remove("is-docked");
        setProgress(pull / pullDistance);
        if (state === "pulling") {
          schedulePullSettle();
        } else {
          window.clearTimeout(resetTimer);
        }
        return;
      }

      reversePull = 0;
      if (state === "passed") {
        transitions?.enterContents(event);
        return;
      }
      if (state === "docked") {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      window.clearTimeout(releaseTimer);
      lockHeroScroll();

      // 阻尼感:越往下拉阻力越大(resistance 越小),到一半时速度减半。
      const resistance = 1 - clamp(pull / pullDistance) * 0.5;
      pull = clamp(pull + event.deltaY * resistance, 0, pullDistance);
      const progress = pull / pullDistance;

      hero.classList.add("is-pulling");
      hero.classList.remove("is-docked");
      state = "pulling";
      setProgress(progress);
      schedulePullSettle();
    };

    // 原生 scroll 处理器:锁定期间把页面拉回顶部防止"漏滚",
    // 同时根据滚动位置更新 --hero-dim(首屏变暗程度),回滚到顶时恢复停靠态。
    const handleHeroScroll = () => {
      if (!stage || !hero) return;

      if (scrollRoot.classList.contains(scrollLockClass) && window.scrollY > 2
        && !correctingScroll && !scrollRoot.classList.contains("is-notice-open")) {
        correctingScroll = true;
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        correctingScroll = false;
      }
      const nativeProgress = clamp(-stage.getBoundingClientRect().top / (window.innerHeight || 1));
      hero.style.setProperty("--hero-dim", `${0.12 + clamp((nativeProgress - 1.05) / 0.25) * 0.12}`);

      if (window.scrollY <= 2 && state === "passed") {
        pull = pullDistance;
        hero.classList.remove("is-pulling");
        hero.classList.add("is-docked");
        setProgress(1);
      }
    };

    // 启动两条打字机:终端命令行,以及名字(节奏更慢一些)。
    runTypingLoop(typingTarget, terminalLines);
    runTypingLoop(nameTarget, nameLines, 96, 46, 1500);

    const pokeAvatar = document.querySelector("[data-poke-avatar]");
    const avatarFlower = document.querySelector("[data-avatar-flower]");
    const pokeBubble = document.querySelector("[data-poke-bubble]");
    let lastPokeAt = 0;
    let bubbleTimer = 0;
    let pokeTimer = 0;
    let flowerPointerId = null;
    let flowerDragX = 0;
    let flowerDragAngle = 0;
    let flowerAngle = 0;
    const reduceFlowerMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // 显示"戳一戳"台词气泡,1700 毫秒后自动隐藏;重复戳会重置这个定时器。
    const showPokeBubble = (text) => {
      if (!pokeBubble) return;
      pokeBubble.textContent = text;
      pokeBubble.classList.add("is-visible");
      window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(() => {
        pokeBubble.classList.remove("is-visible");
      }, 1700);
    };

    // 把花朵摆动角度限制在 ±32° 后写入 CSS 变量 --flower-sway。
    const setFlowerAngle = (angle) => {
      flowerAngle = clamp(angle, -32, 32);
      avatarFlower.style.setProperty("--flower-sway", `${flowerAngle}deg`);
    };

    // 无障碍:滚动被锁住时,让键盘快捷键或"跳到正文"链接直接越过首屏门槛。
    const skipHeroGate = () => {
      if (!scrollRoot.classList.contains(scrollLockClass)) return;
      dockProfile();
      releaseScroll();
    };
    // 方向键/空格/End 也能跳过门槛;但按住 Ctrl/Alt 等组合键、
    // 或焦点在输入框里时放过,避免抢走正常键盘操作。
    const handleNavigationKey = (event) => {
      if (!scrollRoot.classList.contains(scrollLockClass)
        || scrollRoot.classList.contains("is-notice-open")
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        || !["ArrowDown", "PageDown", "End", " "].includes(event.key)
        || event.target?.closest?.("a, button, input, select, textarea, [contenteditable]")) return;
      if (event.key === "End") {
        skipHeroGate();
        return;
      }
      event.preventDefault();
      if (state === "pulling") dockProfile();
    };
    const handleContentFocus = (event) => {
      if (scrollRoot.classList.contains(scrollLockClass)
        && event.target?.closest?.("#page-content")
        && !stage?.contains?.(event.target)) skipHeroGate();
    };
    const skipLinks = [hero?.querySelector(".scroll-cue"), document.querySelector(".skip-to-content")].filter(Boolean);

    // pointermove 同时覆盖鼠标、触摸和触控笔。没按下时花朵跟随鼠标横向位置
    // 轻轻摆动;按下拖动时则按拖动距离改变角度。
    const handleFlowerMove = (event) => {
      if (flowerPointerId !== null) {
        if (event.pointerId === flowerPointerId) {
          setFlowerAngle(flowerDragAngle + (event.clientX - flowerDragX) * 0.45);
        }
        return;
      }
      if (reduceFlowerMotion) return;
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = avatarFlower.getBoundingClientRect();
      avatarFlower.classList.add("is-tracking");
      setFlowerAngle(((event.clientX - rect.left) / rect.width - 0.5) * 40);
    };

    // setPointerCapture 把后续指针事件锁定到花朵上,即使鼠标移出元素也能继续拖动。
    const handleFlowerDown = (event) => {
      if (flowerPointerId !== null || event.isPrimary === false || event.button !== 0) return;
      event.preventDefault();
      flowerPointerId = event.pointerId;
      flowerDragX = event.clientX;
      flowerDragAngle = flowerAngle;
      avatarFlower.classList.remove("is-tracking");
      avatarFlower.classList.add("is-dragging");
      avatarFlower.setPointerCapture(event.pointerId);
    };

    const resetFlower = () => {
      flowerPointerId = null;
      avatarFlower.classList.remove("is-tracking", "is-dragging");
      setFlowerAngle(0);
    };

    const handleFlowerUp = (event) => {
      if (event.pointerId !== flowerPointerId) return;
      if (avatarFlower.hasPointerCapture(event.pointerId)) {
        avatarFlower.releasePointerCapture(event.pointerId);
      }
      resetFlower();
    };

    const handleFlowerLeave = () => {
      if (flowerPointerId === null) resetFlower();
    };

    // 双击头像触发"戳一戳"反应,10 秒冷却防止连点刷屏。
    const handlePokeDoubleClick = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastPokeAt < 10000) {
        showPokeBubble("\u64cd\u4f5c\u592a\u5feb\u5566\uff0c\u4f11\u606f\u4e00\u4e0b\u5427");
        return;
      }

      lastPokeAt = now;
      pokeAvatar.classList.remove("is-poked");
      // 读一次 offsetWidth 强制浏览器重排,让移除/添加类的动画能重新播放。
      void pokeAvatar.offsetWidth;
      pokeAvatar.classList.add("is-poked");
      showPokeBubble("\u6233\u5230\u4e86~");
      window.clearTimeout(pokeTimer);
      pokeTimer = window.setTimeout(() => pokeAvatar.classList.remove("is-poked"), 720);
    };

    // 注册花朵拖拽/戳头像的监听,并在下面把对应的 removeEventListener 收集进清理任务。
    avatarFlower?.addEventListener("pointermove", handleFlowerMove);
    avatarFlower?.addEventListener("pointerdown", handleFlowerDown);
    avatarFlower?.addEventListener("pointerup", handleFlowerUp);
    avatarFlower?.addEventListener("pointercancel", handleFlowerUp);
    avatarFlower?.addEventListener("lostpointercapture", handleFlowerUp);
    avatarFlower?.addEventListener("pointerleave", handleFlowerLeave);
    pokeAvatar?.addEventListener("dblclick", handlePokeDoubleClick);
    heroCleanupTasks.push(() => {
      if (flowerPointerId !== null && avatarFlower?.hasPointerCapture(flowerPointerId)) {
        avatarFlower.releasePointerCapture(flowerPointerId);
      }
      if (avatarFlower) resetFlower();
      avatarFlower?.removeEventListener("pointermove", handleFlowerMove);
      avatarFlower?.removeEventListener("pointerdown", handleFlowerDown);
      avatarFlower?.removeEventListener("pointerup", handleFlowerUp);
      avatarFlower?.removeEventListener("pointercancel", handleFlowerUp);
      avatarFlower?.removeEventListener("lostpointercapture", handleFlowerUp);
      avatarFlower?.removeEventListener("pointerleave", handleFlowerLeave);
      pokeAvatar?.removeEventListener("dblclick", handlePokeDoubleClick);
    });

    // 初始化:先渲染初始进度,再注册剩余的事件监听。
    setProgress(0);
    handleHeroScroll();
    profileCard?.addEventListener("transitionend", handleProfileTransitionEnd);
    skipLinks.forEach((link) => link.addEventListener("click", skipHeroGate));
    document.addEventListener("keydown", handleNavigationKey);
    document.addEventListener("focusin", handleContentFocus);
    // wheel 用 passive:false,因为处理器里要 preventDefault() 拦截默认滚动;
    // scroll 只读不拦截,用 passive:true 让浏览器滚动更流畅。
    window.addEventListener("wheel", handleHeroWheel, { passive: false });
    window.addEventListener("scroll", handleHeroScroll, { passive: true });
    window.addEventListener("resize", handleHeroScroll);
    window.addEventListener("pageshow", handleHeroScroll);
    // 统一的清理任务:清掉所有定时器、解除滚动锁、移除所有事件监听。
    heroCleanupTasks.push(() => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(bubbleTimer);
      window.clearTimeout(pokeTimer);
      typingTimers.forEach((timer) => window.clearTimeout(timer));
      typingTimers.clear();
      unlockHeroScroll();
      profileCard?.removeEventListener("transitionend", handleProfileTransitionEnd);
      skipLinks.forEach((link) => link.removeEventListener("click", skipHeroGate));
      document.removeEventListener("keydown", handleNavigationKey);
      document.removeEventListener("focusin", handleContentFocus);
      window.removeEventListener("wheel", handleHeroWheel);
      window.removeEventListener("scroll", handleHeroScroll);
      window.removeEventListener("resize", handleHeroScroll);
      window.removeEventListener("pageshow", handleHeroScroll);
    });

    // 把清理函数作为返回值交还调用方,方便组件卸载时主动调用。
    return window.__lunkeyHeroCleanup;
}
