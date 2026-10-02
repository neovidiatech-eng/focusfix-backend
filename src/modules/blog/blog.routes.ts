import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { requireAuth, AuthenticatedRequest } from '../auth/auth.middleware';

const router = Router();

// PUBLIC: GET /api/v1/blog/posts
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

// PUBLIC: GET /api/v1/blog/posts/:slug
router.get('/posts/:slug', async (req: Request, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: req.params.slug },
    });
    if (!post) return res.status(404).json({ error: 'Post not found' });

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

// ADMIN: GET /api/v1/blog/admin/all
router.get('/admin/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin posts' });
  }
});

// ADMIN: POST /api/v1/blog/admin/posts
router.post('/admin/posts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title_ar, title_en, slug, content_html, content_json, excerpt_ar, excerpt_en, status } = req.body;
    const post = await prisma.blogPost.create({
      data: {
        title_ar,
        title_en: title_en || title_ar,
        slug,
        content_html,
        content_json: content_json || {},
        excerpt_ar,
        excerpt_en,
        status: status || 'draft',
        published_at: status === 'published' ? new Date() : null,
      },
    });

    if (status === 'published') {
      triggerRevalidation(['blog', `blog:${slug}`]).catch(() => {});
    }

    res.status(201).json(post);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create post' });
  }
});

// ADMIN: PUT /api/v1/blog/admin/posts/:id
router.put('/admin/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title_ar, title_en, content_html, content_json, excerpt_ar, status } = req.body;

    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title_ar,
        title_en,
        content_html,
        content_json,
        excerpt_ar,
        status,
        published_at: status === 'published' ? new Date() : undefined,
      },
    });

    // Create revision snapshot
    if (content_json) {
      await prisma.blogRevision.create({
        data: {
          post_id: post.id,
          content_json,
          created_by: req.user?.email || 'admin',
        },
      });
    }

    triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    res.json(post);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update post' });
  }
});

export default router;
