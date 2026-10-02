import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/blog/posts
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        slug: true,
        title_ar: true,
        title_en: true,
        excerpt_ar: true,
        excerpt_en: true,
        reading_minutes: true,
        published_at: true,
        og_image_url: true,
        views_count: true,
      },
      orderBy: { published_at: 'desc' },
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/v1/blog/posts/:slug
router.get('/posts/:slug', async (req: Request, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: req.params.slug },
    });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment views asynchronously
    prisma.blogPost
      .update({
        where: { id: post.id },
        data: { views_count: { increment: 1 } },
      })
      .catch(() => {});

    res.json(post);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

export default router;
