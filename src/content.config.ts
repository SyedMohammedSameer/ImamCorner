import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The staff editor (Decap CMS) saves blank optional fields as "" or null; treat those as absent.
const blank = (v: unknown) => (v === '' || v === null ? undefined : v);
const opt = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(blank, schema.optional());

const imams = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/imams' }),
  schema: z.object({
    name: z.string(),
    shortName: z.string(),
    role: z.string(),
    order: z.number().default(0),
    email: opt(z.string()),
    photo: opt(z.string()),
    languages: z.array(z.string()).default([]),
    focus: z.array(z.string()).default([]),
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    type: z.enum(['khutbah', 'book', 'notes', 'guide']),
    date: z.coerce.date(),
    pdf: z.string(),
    author: opt(z.string()),
    khateeb: opt(reference('imams')),
    summary: z.preprocess((v) => v ?? '', z.string()),
    tags: z.preprocess((v) => v ?? [], z.array(z.string())),
    pages: opt(z.number()),
    audio: opt(z.string()),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    category: z.enum(['Start here', 'Qur’an & Tafsir', 'Prophetic biography', 'Hadith', 'Spirituality', 'Belief', 'Family & youth']),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    why: z.string(),
    resource: opt(reference('resources')),
    link: opt(z.string()),
    order: z.number().default(100),
  }),
});

const announcements = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/announcements' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    expires: opt(z.coerce.date()),
    link: opt(z.string()),
    linkLabel: opt(z.string()),
  }),
});

export const collections = { imams, resources, books, announcements };
