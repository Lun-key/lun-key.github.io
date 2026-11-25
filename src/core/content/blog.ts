/**
 * 博客文章的读取与整理工具，是“内容集合”面向页面的统一出口。
 * 封装 astro:content 的 getCollection，提供“已发布文章列表”和“静态路由参数”两个函数。
 * getCollection("blog") 是 Astro 的方法，用来取出 content.config.ts 定义的 blog 集合；
 * 它的第二个参数是过滤回调，这里用它剔除草稿（data.draft 为 true 的文章）。
 * 被引用：getPublishedPosts → 首页 / 博客列表页（HomePage、BlogIndexPage）；
 *getPublishedPostPaths → 各主题 [...slug].astro 的 getStaticPaths()，用来生成文章详情页路由。
 */
import { getCollection, type CollectionEntry } from "astro:content";

// BlogPost：单篇文章的类型别名，页面用它标注 props 类型；改集合名 "blog" 要同步 content.config.ts。
export type BlogPost = CollectionEntry<"blog">;

// 取所有“已发布”文章，按时间从新到旧排序（优先用 updatedDate，没有则用 pubDate）。
export async function getPublishedPosts() {
  // 第二个参数是过滤器：!data.draft 表示只保留非草稿文章。
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort((a, b) => {
    // 有更新日期就用更新日期，否则用发布日期；b - a 得到降序（新的排前面）。
    const dateA = (a.data.updatedDate ?? a.data.pubDate).valueOf();
    const dateB = (b.data.updatedDate ?? b.data.pubDate).valueOf();
    return dateB - dateA;
  });
}

// 给 Astro 动态路由 getStaticPaths() 用的参数列表：params 决定 URL，props 把文章对象传给页面。
export async function getPublishedPostPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post }
  }));
}

