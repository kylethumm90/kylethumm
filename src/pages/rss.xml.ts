import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const blog = await getCollection('blog', ({ data }) => !data.draft);
  const sorted = blog.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  return rss({
    title: 'Kyle Thumm',
    description: 'Marketing insights from the trenches. Paid media, automation, AI, and growth strategy.',
    site: context.site!,
    items: sorted.map(post => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/blog/${post.id}/`,
    })),
  });
}
