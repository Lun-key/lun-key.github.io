// 个人资料数据 — About 页面、首页终端卡片、社交链接等

// 基本身份信息
export const profileIdentity = {
  displayName: "Lunkey",
  handle: "Lumen Kael Xystus",
  siteName: "Lumen Kael Xystus",
  bio: "二次元技术宅 / 兴趣驱动型，对于一件事可能做得不完美但喜欢做到结束，喜欢研究有意思的小东西，我很懒文章更新时间看心情，目前仍然在向前学习中。", // 个人简介
  github: "https://github.com/Lun-key", // GitHub 主页链接
  bilibili: "https://space.bilibili.com/3690985108277542" // Bilibili 空间链接
} as const;

// 当前状态标签（首页终端卡片显示）
export const profileStatus = [
  "正在学习 java全栈开发",
  "在折腾 godot / 前端 / java后端 / agent开发应用 / blog主题",
  "在玩galgame",
  "喜欢把技术做得有点可爱"
] as const;

// 技术栈 / 工具栈（About 页面展示）
export const profileTech = [
  { key: "godot", name: "Godot", note: "游戏开发学习" },
  { key: "SpringAI", name: "SpringAI", note: "人工智能学习" },
  { key: "java全栈", name: "Java全栈", note: "正在学习中" },
  { key: "agent开发应用", name: "Agent开发应用", note: "智能体开发应用" },
  { key: "Vue", name: "Vue", note: "前端框架学习" },
  { key: "css", name: "css", note: "css学习中" },
  { key: "astro", name: "Astro", note: "前端框架学习" },
  { key: "docker", name: "Docker", note: "容器化学习" },
  { key: "git", name: "Git", note: "版本控制工具" },
  { key: "githubActions", name: "GitHub Actions", note: "自动化工具" },
] as const;

// 喜欢的动漫作品（About 页面动漫收藏图）
// key 对应 public/themes/lumen-kael-xystus/assets/about/{key}.webp
export const animeFavorites = [
  { key: "summer-pockets", title: "Summer Pockets", subtitle: "夏日口袋" },
  { key: "spring-mono", title: "我的青春恋爱物语果然有问题", subtitle: "春物" },
  { key: "Botan-Kamiina", title: "上伊那牡丹", subtitle: "上伊那ぼたん、酔へる姿は百合の花" },
  { key: "mushoku-tensei", title: "无职转生", subtitle: "Mushoku Tensei" },
  { key: "FLCL", title: "FLCL", subtitle: "特别的她" },
  { key: "Ikoku-Nikki", title: "异国日记", subtitle: "Ikoku-Nikki" },
  { key: "key", title: "key", subtitle: "key社" },
  { key: "Monogatari-Series", title: "物语系列", subtitle: "〈物語〉シリーズ ファイナルシーズン" },
  { key: "Rimeiku", title: "我们的重置人生", subtitle: "Rimeiku"
  },
  { key: "Sangatsu-no-Lion", title: "三月的狮子", subtitle: "Sangatsu-no-Lion" },
  { key: "The-Tatami-Galaxy", title: "四叠半神话大系", subtitle: "The-Tatami-Galaxy" },
  { key: "Yuru-Camp", title: "摇曳露营", subtitle: "Yuru-Camp" }
] as const;

// XP 收藏（About 页面 XP 图）
// key 对应 public/themes/lumen-kael-xystus/assets/about/xp-{key}.webp
export const xpFavorites = [
  { key: "loli", title: "吸血鬼萝莉", subtitle: "Vampire Lollipop" },
  { key: "White-hair", title: "白毛", subtitle: "White hair" },
  { key: "Natural", title: "天然呆", subtitle: "Natural" },
  { key: "Radio-system", title: "电波系", subtitle: "Radio system" },
  { key: "Mean-words", title: "毒舌", subtitle: "どくぜつ" },
  { key: "Leg-control", title: "腿控", subtitle: "Leg control" }
] as const;

// 喜欢的游戏（About 页面游戏收藏图）
// key 对应 public/themes/lumen-kael-xystus/assets/about/{key}.webp
export const favoriteGames = [
  { key: "Heaven-Burns-Red", title: "Heaven-Burns-Red", subtitle: "红烧天堂" },
  { key: "Rain98", title: "Rain98", subtitle: "Rain98" }
] as const;

// 当前动态信号（About 页面"当前状态"区域）
export const currentSignals = [
  { label: "正在学习", text: "java全栈开发，目前自己的能力完全不行。" },
  { label: "最近在折腾", text: "blog主题、前端学习、算法学习 、部署教程、以及能让博客动起来的小机关。" },
  { label: "今日电波", text: "技术可以严谨一点，呈现方式可以更像玩具一点,技术固然重要,但乐趣也同样重要。" }
] as const;

