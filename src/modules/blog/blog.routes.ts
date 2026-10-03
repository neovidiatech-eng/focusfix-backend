import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { requireAuth, AuthenticatedRequest } from '../auth/auth.middleware';

const router = Router();

// ==========================================
// 1. PUBLIC ENDPOINTS
// ==========================================

// GET /api/v1/blog/posts - Public posts listing
router.get('/posts', async (req: Request, res: Response) => {
  try {
    const { category, tag, author, search, page = '1', limit = '10' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = {
      status: 'published',
    };

    if (category) {
      where.category = { slug: String(category) };
    }

    if (tag) {
      where.tags = {
        some: {
          tag: { slug: String(tag) },
        },
      };
    }

    if (author) {
      where.author = { slug: String(author) };
    }

    if (search) {
      where.OR = [
        { title_ar: { contains: String(search), mode: 'insensitive' } },
        { title_en: { contains: String(search), mode: 'insensitive' } },
        { excerpt_ar: { contains: String(search), mode: 'insensitive' } },
        { excerpt_en: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [total, posts] = await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title_ar: true,
          title_en: true,
          excerpt_ar: true,
          excerpt_en: true,
          reading_minutes: true,
          published_at: true,
          featured_image: true,
          featured_image_alt: true,
          og_image_url: true,
          views_count: true,
          category: {
            select: { id: true, name_ar: true, name_en: true, slug: true },
          },
          author: {
            select: { id: true, name_ar: true, name_en: true, avatar_url: true, role_title: true },
          },
          tags: {
            select: {
              tag: {
                select: { id: true, name_ar: true, name_en: true, slug: true },
              },
            },
          },
        },
        orderBy: { published_at: 'desc' },
        skip,
        take,
      }),
    ]);

    const formattedPosts = posts.map((p) => ({
      ...p,
      tags: p.tags.map((t) => t.tag),
    }));

    res.json({
      data: formattedPosts,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/v1/blog/posts/:slug - Public single post by slug
router.get('/posts/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        category: true,
        author: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    if (!post) {
      // Check for redirect record if slug was previously changed
      const redirect = await prisma.redirect.findUnique({
        where: { from_path: `/blog/${slug}` },
      });
      if (redirect) {
        return res.status(301).json({ redirect: redirect.to_path, statusCode: 301 });
      }
      return res.status(404).json({ error: 'Post not found' });
    }

    if (post.status !== 'published') {
      return res.status(404).json({ error: 'Post not published' });
    }

    // Increment view count asynchronously
    prisma.blogPost
      .update({
        where: { id: post.id },
        data: { views_count: { increment: 1 } },
      })
      .catch(() => {});

    // Fetch related posts (by same category or recent)
    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        status: 'published',
        id: { not: post.id },
        ...(post.category_id ? { category_id: post.category_id } : {}),
      },
      select: {
        id: true,
        slug: true,
        title_ar: true,
        title_en: true,
        featured_image: true,
        published_at: true,
        reading_minutes: true,
      },
      take: 3,
      orderBy: { published_at: 'desc' },
    });

    res.json({
      ...post,
      tags: post.tags.map((t) => t.tag),
      relatedPosts,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// GET /api/v1/blog/categories - Public categories
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: { status: 'published' },
            },
          },
        },
      },
      orderBy: { name_ar: 'asc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/v1/blog/tags - Public tags
router.get('/tags', async (_req: Request, res: Response) => {
  try {
    const tags = await prisma.blogTag.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name_ar: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /api/v1/blog/authors - Public authors
router.get('/authors', async (_req: Request, res: Response) => {
  try {
    const authors = await prisma.blogAuthor.findMany({
      include: {
        _count: {
          select: {
            posts: {
              where: { status: 'published' },
            },
          },
        },
      },
      orderBy: { name_ar: 'asc' },
    });
    res.json(authors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
});

// ==========================================
// 2. INTERNAL LINK ASSISTANT
// ==========================================

// GET /api/v1/blog/internal-links - Search internal site routes & posts for Link Picker
router.get('/internal-links', async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();

    // Standard static site pages
    const staticPages = [
      { title: 'الرئيسية (Home)', url: '/', type: 'page' },
      { title: 'حجز موعد صيانة (Book Repair)', url: '/booking', type: 'page' },
      { title: 'أسعار الصيانة (Pricing)', url: '/pricing', type: 'page' },
      { title: 'الموديلات المدعومة (Devices Catalog)', url: '/catalog', type: 'page' },
      { title: 'المناطق المغطاة (Coverage Areas)', url: '/areas', type: 'page' },
      { title: 'المدونة والمقالات (Blog)', url: '/blog', type: 'page' },
      { title: 'عن فوكس فيكس (About Us)', url: '/about', type: 'page' },
      { title: 'تواصل معنا (Contact Us)', url: '/contact', type: 'page' },
      { title: 'الشروط والأحكام (Terms)', url: '/terms', type: 'page' },
      { title: 'سياسة الخصوصية (Privacy)', url: '/privacy', type: 'page' },
    ];

    const filteredPages = query
      ? staticPages.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            p.url.toLowerCase().includes(query)
        )
      : staticPages;

    // Published blog posts
    const posts = await prisma.blogPost.findMany({
      where: {
        status: 'published',
        ...(query
          ? {
              OR: [
                { title_ar: { contains: query, mode: 'insensitive' } },
                { title_en: { contains: query, mode: 'insensitive' } },
                { slug: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title_ar: true,
        title_en: true,
        slug: true,
      },
      take: 10,
    });

    const postItems = posts.map((p) => ({
      title: `${p.title_ar} (${p.title_en})`,
      url: `/blog/${p.slug}`,
      type: 'article',
    }));

    res.json([...filteredPages, ...postItems]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search internal links' });
  }
});

// ==========================================
// 3. ADMIN ARTICLES MANAGEMENT
// ==========================================

// GET /api/v1/blog/admin/all - Admin posts with counts by status, filters & search
router.get('/admin/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, categoryId, authorId, search, date } = req.query;

    const where: Record<string, unknown> = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (categoryId && categoryId !== 'all') {
      where.category_id = categoryId;
    }

    if (authorId && authorId !== 'all') {
      where.author_id = authorId;
    }

    if (date) {
      const targetDate = new Date(String(date));
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      where.created_at = {
        gte: targetDate,
        lt: nextDate,
      };
    }

    if (search) {
      const q = String(search).trim();
      where.OR = [
        { title_ar: { contains: q, mode: 'insensitive' } },
        { title_en: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Counts for status tabs
    const [allCount, publishedCount, draftCount, scheduledCount, trashCount] = await Promise.all([
      prisma.blogPost.count({ where: { status: { not: 'archived' } } }),
      prisma.blogPost.count({ where: { status: 'published' } }),
      prisma.blogPost.count({ where: { status: 'draft' } }),
      prisma.blogPost.count({ where: { status: 'scheduled' } }),
      prisma.blogPost.count({ where: { status: 'archived' } }),
    ]);

    const posts = await prisma.blogPost.findMany({
      where,
      include: {
        category: {
          select: { id: true, name_ar: true, name_en: true, slug: true },
        },
        author: {
          select: { id: true, name_ar: true, name_en: true, avatar_url: true },
        },
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formattedPosts = posts.map((p) => ({
      ...p,
      tags: p.tags.map((t) => t.tag),
    }));

    res.json({
      posts: formattedPosts,
      counts: {
        all: allCount,
        published: publishedCount,
        draft: draftCount,
        scheduled: scheduledCount,
        trash: trashCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin posts' });
  }
});

// GET /api/v1/blog/admin/posts/:id - Full article by ID for editing
router.get('/admin/posts/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        author: true,
        tags: {
          include: { tag: true },
        },
        revisions: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
    });

    if (!post) return res.status(404).json({ error: 'Post not found' });

    res.json({
      ...post,
      tags: post.tags.map((t) => t.tag),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/v1/blog/admin/posts - Create new article
router.post('/admin/posts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title_ar,
      title_en,
      slug,
      content_html,
      content_html_en,
      content_json,
      excerpt_ar,
      excerpt_en,
      category_id,
      author_id,
      featured_image,
      featured_image_alt,
      featured_image_caption,
      focus_keyword,
      meta_title_ar,
      meta_title_en,
      meta_desc_ar,
      meta_desc_en,
      canonical_url,
      robots_index = true,
      robots_follow = true,
      related_post_ids,
      status = 'draft',
      scheduled_at,
      tags = [],
    } = req.body;

    if (!title_ar || !slug) {
      return res.status(400).json({ error: 'Arabic title and URL slug are required' });
    }

    // Check slug uniqueness
    const existingSlug = await prisma.blogPost.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'Slug is already in use by another article' });
    }

    const post = await prisma.blogPost.create({
      data: {
        title_ar,
        title_en: title_en || title_ar,
        slug: slug.trim().toLowerCase(),
        content_html: content_html || '',
        content_html_en: content_html_en || '',
        content_json: content_json || {},
        excerpt_ar,
        excerpt_en,
        category_id: category_id || null,
        author_id: author_id || null,
        featured_image,
        featured_image_alt,
        featured_image_caption,
        focus_keyword,
        meta_title_ar,
        meta_title_en,
        meta_desc_ar,
        meta_desc_en,
        canonical_url,
        robots_index: Boolean(robots_index),
        robots_follow: Boolean(robots_follow),
        related_post_ids: related_post_ids || [],
        status,
        published_at: status === 'published' ? new Date() : null,
        scheduled_at: status === 'scheduled' && scheduled_at ? new Date(scheduled_at) : null,
      },
    });

    // Handle tags
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tagItem of tags) {
        let tagId = typeof tagItem === 'string' ? tagItem : tagItem.id;
        // If it's a new tag string name
        if (typeof tagItem === 'string' && tagItem.startsWith('new:')) {
          const tagName = tagItem.replace('new:', '').trim();
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
          const createdTag = await prisma.blogTag.upsert({
            where: { slug: tagSlug },
            create: { name_ar: tagName, name_en: tagName, slug: tagSlug },
            update: {},
          });
          tagId = createdTag.id;
        }

        if (tagId) {
          await prisma.blogPostTag.create({
            data: { post_id: post.id, tag_id: tagId },
          }).catch(() => {});
        }
      }
    }

    // Initial revision snapshot
    await prisma.blogRevision.create({
      data: {
        post_id: post.id,
        content_json: content_json || { html: content_html },
        created_by: req.user?.email || 'admin',
      },
    });

    if (status === 'published') {
      triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    }

    res.status(201).json(post);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to create post';
    res.status(400).json({ error: msg });
  }
});

// PUT /api/v1/blog/admin/posts/:id - Update article
router.put('/admin/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Article not found' });

    const {
      title_ar,
      title_en,
      slug,
      content_html,
      content_html_en,
      content_json,
      excerpt_ar,
      excerpt_en,
      category_id,
      author_id,
      featured_image,
      featured_image_alt,
      featured_image_caption,
      focus_keyword,
      meta_title_ar,
      meta_title_en,
      meta_desc_ar,
      meta_desc_en,
      canonical_url,
      robots_index,
      robots_follow,
      related_post_ids,
      status,
      scheduled_at,
      tags,
    } = req.body;

    const newSlug = slug ? slug.trim().toLowerCase() : existing.slug;

    // If slug changed, create an automatic 301 redirect from old slug to prevent broken SEO links!
    if (newSlug !== existing.slug) {
      const existingWithSlug = await prisma.blogPost.findUnique({ where: { slug: newSlug } });
      if (existingWithSlug && existingWithSlug.id !== existing.id) {
        return res.status(400).json({ error: 'This URL slug is already taken by another article' });
      }

      await prisma.redirect.upsert({
        where: { from_path: `/blog/${existing.slug}` },
        create: {
          from_path: `/blog/${existing.slug}`,
          to_path: `/blog/${newSlug}`,
          status_code: 301,
        },
        update: {
          to_path: `/blog/${newSlug}`,
        },
      }).catch(() => {});
    }

    const updated = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: {
        title_ar: title_ar ?? existing.title_ar,
        title_en: title_en ?? existing.title_en,
        slug: newSlug,
        content_html: content_html ?? existing.content_html,
        content_html_en: content_html_en ?? existing.content_html_en,
        content_json: content_json ?? existing.content_json,
        excerpt_ar: excerpt_ar ?? existing.excerpt_ar,
        excerpt_en: excerpt_en ?? existing.excerpt_en,
        category_id: category_id !== undefined ? (category_id || null) : existing.category_id,
        author_id: author_id !== undefined ? (author_id || null) : existing.author_id,
        featured_image: featured_image ?? existing.featured_image,
        featured_image_alt: featured_image_alt ?? existing.featured_image_alt,
        featured_image_caption: featured_image_caption ?? existing.featured_image_caption,
        focus_keyword: focus_keyword ?? existing.focus_keyword,
        meta_title_ar: meta_title_ar ?? existing.meta_title_ar,
        meta_title_en: meta_title_en ?? existing.meta_title_en,
        meta_desc_ar: meta_desc_ar ?? existing.meta_desc_ar,
        meta_desc_en: meta_desc_en ?? existing.meta_desc_en,
        canonical_url: canonical_url ?? existing.canonical_url,
        robots_index: robots_index !== undefined ? Boolean(robots_index) : existing.robots_index,
        robots_follow: robots_follow !== undefined ? Boolean(robots_follow) : existing.robots_follow,
        related_post_ids: related_post_ids ?? existing.related_post_ids,
        status: status ?? existing.status,
        published_at:
          status === 'published' && !existing.published_at
            ? new Date()
            : existing.published_at,
        scheduled_at:
          status === 'scheduled' && scheduled_at
            ? new Date(scheduled_at)
            : existing.scheduled_at,
      },
    });

    // Sync tags if passed
    if (Array.isArray(tags)) {
      await prisma.blogPostTag.deleteMany({ where: { post_id: existing.id } });
      for (const tagItem of tags) {
        let tagId = typeof tagItem === 'string' ? tagItem : tagItem.id;
        if (typeof tagItem === 'string' && tagItem.startsWith('new:')) {
          const tagName = tagItem.replace('new:', '').trim();
          const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');
          const createdTag = await prisma.blogTag.upsert({
            where: { slug: tagSlug },
            create: { name_ar: tagName, name_en: tagName, slug: tagSlug },
            update: {},
          });
          tagId = createdTag.id;
        }

        if (tagId) {
          await prisma.blogPostTag.create({
            data: { post_id: existing.id, tag_id: tagId },
          }).catch(() => {});
        }
      }
    }

    // Save revision
    if (content_html || content_json) {
      await prisma.blogRevision.create({
        data: {
          post_id: existing.id,
          content_json: content_json || { html: content_html },
          created_by: req.user?.email || 'admin',
        },
      });
    }

    triggerRevalidation(['blog', `blog:${updated.slug}`, `blog:${existing.slug}`]).catch(() => {});

    res.json(updated);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update post';
    res.status(400).json({ error: msg });
  }
});

// POST /api/v1/blog/admin/posts/:id/duplicate - Duplicate post as draft
router.post('/admin/posts/:id/duplicate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const original = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: { tags: true },
    });

    if (!original) return res.status(404).json({ error: 'Post not found' });

    const newSlug = `${original.slug}-copy-${Date.now().toString().slice(-4)}`;

    const copy = await prisma.blogPost.create({
      data: {
        title_ar: `${original.title_ar} (نسخة)`,
        title_en: `${original.title_en} (Copy)`,
        slug: newSlug,
        content_html: original.content_html,
        content_html_en: original.content_html_en,
        content_json: original.content_json || {},
        excerpt_ar: original.excerpt_ar,
        excerpt_en: original.excerpt_en,
        category_id: original.category_id,
        author_id: original.author_id,
        featured_image: original.featured_image,
        featured_image_alt: original.featured_image_alt,
        featured_image_caption: original.featured_image_caption,
        focus_keyword: original.focus_keyword,
        meta_title_ar: original.meta_title_ar,
        meta_title_en: original.meta_title_en,
        meta_desc_ar: original.meta_desc_ar,
        meta_desc_en: original.meta_desc_en,
        canonical_url: original.canonical_url,
        robots_index: original.robots_index,
        robots_follow: original.robots_follow,
        status: 'draft',
      },
    });

    // Copy tags
    for (const tagRel of original.tags) {
      await prisma.blogPostTag.create({
        data: { post_id: copy.id, tag_id: tagRel.tag_id },
      }).catch(() => {});
    }

    res.status(201).json(copy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate post' });
  }
});

// PATCH /api/v1/blog/admin/posts/:id/trash - Move to Trash
router.patch('/admin/posts/:id/trash', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { status: 'archived' },
    });
    triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: 'Failed to move to trash' });
  }
});

// PATCH /api/v1/blog/admin/posts/:id/restore - Restore from Trash
router.patch('/admin/posts/:id/restore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.update({
      where: { id: req.params.id },
      data: { status: 'draft' },
    });
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore article' });
  }
});

// DELETE /api/v1/blog/admin/posts/:id - Permanently Delete
router.delete('/admin/posts/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.blogPost.delete({
      where: { id: req.params.id },
    });
    triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete post' });
  }
});

// PATCH /api/v1/blog/admin/bulk - Bulk actions
router.patch('/admin/bulk', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { ids, action, value } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of post IDs is required' });
    }

    if (action === 'delete') {
      await prisma.blogPost.deleteMany({ where: { id: { in: ids } } });
      return res.json({ success: true, count: ids.length });
    }

    if (action === 'trash') {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: { status: 'archived' },
      });
      return res.json({ success: true, count: ids.length });
    }

    if (action === 'change_status' && value) {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: {
          status: value,
          published_at: value === 'published' ? new Date() : undefined,
        },
      });
      return res.json({ success: true, count: ids.length });
    }

    if (action === 'change_category' && value) {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: { category_id: value },
      });
      return res.json({ success: true, count: ids.length });
    }

    res.status(400).json({ error: 'Unsupported bulk action' });
  } catch (error) {
    res.status(500).json({ error: 'Bulk action failed' });
  }
});

// ==========================================
// 4. CATEGORIES CRUD
// ==========================================

// GET /api/v1/blog/admin/categories
router.get('/admin/categories', requireAuth, async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      include: {
        parent: {
          select: { id: true, name_ar: true, name_en: true },
        },
        children: {
          select: { id: true, name_ar: true, name_en: true, slug: true },
        },
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/v1/blog/admin/categories
router.post('/admin/categories', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name_ar, name_en, slug, description_ar, description_en, parent_id } = req.body;
    if (!name_ar || !slug) {
      return res.status(400).json({ error: 'Arabic name and slug are required' });
    }

    const category = await prisma.blogCategory.create({
      data: {
        name_ar,
        name_en: name_en || name_ar,
        slug: slug.trim().toLowerCase(),
        description_ar,
        description_en,
        parent_id: parent_id || null,
      },
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create category' });
  }
});

// PUT /api/v1/blog/admin/categories/:id
router.put('/admin/categories/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name_ar, name_en, slug, description_ar, description_en, parent_id } = req.body;
    const category = await prisma.blogCategory.update({
      where: { id: req.params.id },
      data: {
        name_ar,
        name_en,
        slug: slug?.trim().toLowerCase(),
        description_ar,
        description_en,
        parent_id: parent_id || null,
      },
    });
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/v1/blog/admin/categories/:id
router.delete('/admin/categories/:id', requireAuth, async (_req: Request, res: Response) => {
  try {
    await prisma.blogCategory.delete({ where: { id: _req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete category' });
  }
});

// ==========================================
// 5. TAGS CRUD
// ==========================================

// GET /api/v1/blog/admin/tags
router.get('/admin/tags', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = String(req.query.q || '').trim();
    const tags = await prisma.blogTag.findMany({
      where: query
        ? {
            OR: [
              { name_ar: { contains: query, mode: 'insensitive' } },
              { name_en: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/v1/blog/admin/tags
router.post('/admin/tags', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name_ar, name_en, slug } = req.body;
    if (!name_ar) return res.status(400).json({ error: 'Tag name is required' });

    const tagSlug = slug
      ? slug.trim().toLowerCase()
      : name_ar.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');

    const tag = await prisma.blogTag.upsert({
      where: { slug: tagSlug },
      create: {
        name_ar,
        name_en: name_en || name_ar,
        slug: tagSlug,
      },
      update: {
        name_ar,
        name_en: name_en || name_ar,
      },
    });

    res.status(201).json(tag);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/v1/blog/admin/tags/:id
router.delete('/admin/tags/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.blogTag.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete tag' });
  }
});

// ==========================================
// 6. AUTHORS CRUD
// ==========================================

// GET /api/v1/blog/admin/authors
router.get('/admin/authors', requireAuth, async (_req: Request, res: Response) => {
  try {
    const authors = await prisma.blogAuthor.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(authors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
});

// POST /api/v1/blog/admin/authors
router.post('/admin/authors', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name_ar, name_en, slug, avatar_url, bio_ar, bio_en, role_title } = req.body;
    if (!name_ar || !slug) {
      return res.status(400).json({ error: 'Author name and slug are required' });
    }

    const author = await prisma.blogAuthor.create({
      data: {
        name_ar,
        name_en: name_en || name_ar,
        slug: slug.trim().toLowerCase(),
        avatar_url,
        bio_ar,
        bio_en,
        role_title: role_title || 'كاتب محتوى',
      },
    });

    res.status(201).json(author);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create author' });
  }
});

// PUT /api/v1/blog/admin/authors/:id
router.put('/admin/authors/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name_ar, name_en, slug, avatar_url, bio_ar, bio_en, role_title } = req.body;
    const author = await prisma.blogAuthor.update({
      where: { id: req.params.id },
      data: {
        name_ar,
        name_en,
        slug: slug?.trim().toLowerCase(),
        avatar_url,
        bio_ar,
        bio_en,
        role_title,
      },
    });
    res.json(author);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update author' });
  }
});

// DELETE /api/v1/blog/admin/authors/:id
router.delete('/admin/authors/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.blogAuthor.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Failed to delete author' });
  }
});

export default router;
