// 只排除已审核的原件和已废弃的候选文件。
// public/ 中的文件保持不变；不基于"未找到引用"自动清理其他素材。
export const excludedPublicMedia = [
  ...[
    "cover-01.png", "cover-02.jpg", "cover-03.png", "cover-04.png", "cover-05.png",
    "cover-06.jpg", "cover-07.jpg", "cover-08.jpg", "cover-09.png", "cover-10.jpg"
  ].map(name => `blog-covers/${name}`)
];
