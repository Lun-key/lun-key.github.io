
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// defineCollection：定义一个内容集合；集合名 "blog" 要与取值处的 getCollection("blog") 完全一致。
const blog = defineCollection({
  // loader：用 glob 按通配符批量读取文件；pattern 只认 .md/.mdx，base 是文章所在目录。
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.array(z.string()).default([]),
    // 日期字段。z.coerce.date() 会把字符串转成 Date；排序时优先用 updatedDate，否则用 pubDate（见 blog.ts）。
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    cover: z.string().optional(),
    tags: z.array(z.string()).default([]),
    // 分类是枚举：只允许 tech / anime / life。想加分类，要同时改这里的枚举和 lib/site.ts 的 categoryLabel。
    category: z.enum(["tech", "anime", "life"]).default("tech"),
    // 草稿开关：为 true 的文章会被 getPublishedPosts 过滤掉，不在列表和静态路由中出现。
    draft: z.boolean().default(false)
  })
});


export const collections = { blog };
