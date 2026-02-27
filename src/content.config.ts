import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum(['Paid Media', 'Marketing Ops', 'AI & Automation', 'Leadership', 'Home Services']),
    draft: z.boolean().default(false),
  }),
});

const work = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    industry: z.string(),
    keyMetric: z.string(),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, work };
