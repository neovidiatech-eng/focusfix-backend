import { prisma } from '../../lib/prisma';
import { PostStatus } from '@prisma/client';
import { triggerRevalidation } from '../../lib/revalidate';

export class BlogService {
  // 1. PUBLIC POSTS
  async getPublicPosts(params: {
    category?: string;
    tag?: string;
    author?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const pageNum = Math.max(1, params.page || 1);
    const take = Math.min(50, Math.max(1, params.limit || 10));
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = {
      status: 'published',
    };

    if (params.category) {
      where.category = { slug: String(params.category) };
    }

    if (params.tag) {
      where.tags = {
        some: {
          tag: { slug: String(params.tag) },
        },
      };
    }

    if (params.author) {
      where.author = { slug: String(params.author) };
    }

    if (params.search) {
      where.OR = [
        { title_ar: { contains: String(params.search), mode: 'insensitive' } },
        { title_en: { contains: String(params.search), mode: 'insensitive' } },
        { excerpt_ar: { contains: String(params.search), mode: 'insensitive' } },
        { excerpt_en: { contains: String(params.search), mode: 'insensitive' } },
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

    return {
      data: formattedPosts,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getPublicPostBySlug(slug: string) {
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
      const redirect = await prisma.redirect.findUnique({
        where: { from_path: `/blog/${slug}` },
      });
      if (redirect) {
        return { redirect: redirect.to_path, statusCode: 301 };
      }
      return null;
    }

    if (post.status !== 'published') {
      return { notPublished: true };
    }

    // Increment view count asynchronously
    prisma.blogPost
      .update({
        where: { id: post.id },
        data: { views_count: { increment: 1 } },
      })
      .catch(() => {});

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

    return {
      ...post,
      tags: post.tags.map((t) => t.tag),
      relatedPosts,
    };
  }

  // 2. PUBLIC TAXONOMIES
  async getPublicCategories() {
    return prisma.blogCategory.findMany({
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
  }

  async getPublicTags() {
    return prisma.blogTag.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name_ar: 'asc' },
    });
  }

  async getPublicAuthors() {
    return prisma.blogAuthor.findMany({
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
  }

  async searchInternalLinks(query: string) {
    const q = query.trim().toLowerCase();

    const staticPages = [
      { title: 'الرئيسية (Home)', url: '/', type: 'page' },
      { title: 'حجز موعد صيانة (Book Repair)', url: '/booking', type: 'page' },
      { title: 'أسعار الصيانة (Pricing)', url: '/pricing', type: 'page' },
      { title: 'الموديلات المدعومة (Devices Catalog)', url: '/catalog', type: 'page' },
      { title: 'المناطق المغطاة (Coverage Areas)', url: '/areas', type: 'page' },
      { title: 'المدونة والمقالات (Blog)', url: '/blog', type: 'page' },
      { title: 'شروط الضمان (Warranty)', url: '/warranty', type: 'page' },
      { title: 'تتبع الطلب (Track Booking)', url: '/track', type: 'page' },
      { title: 'اتصل بنا (Contact Us)', url: '/contact', type: 'page' },
    ];

    const [articles, categories] = await Promise.all([
      prisma.blogPost.findMany({
        where: {
          status: 'published',
          ...(q
            ? {
                OR: [
                  { title_ar: { contains: q, mode: 'insensitive' } },
                  { title_en: { contains: q, mode: 'insensitive' } },
                  { slug: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        select: { id: true, title_ar: true, title_en: true, slug: true },
        take: 10,
        orderBy: { published_at: 'desc' },
      }),
      prisma.blogCategory.findMany({
        where: q
          ? {
              OR: [
                { name_ar: { contains: q, mode: 'insensitive' } },
                { name_en: { contains: q, mode: 'insensitive' } },
              ],
            }
          : undefined,
        select: { id: true, name_ar: true, slug: true },
        take: 5,
      }),
    ]);

    const results = [
      ...staticPages
        .filter((p) => !q || p.title.toLowerCase().includes(q) || p.url.includes(q))
        .map((p) => ({ ...p, id: p.url })),
      ...categories.map((c) => ({
        id: c.id,
        title: `تصنيف: ${c.name_ar}`,
        url: `/blog?category=${c.slug}`,
        type: 'category',
      })),
      ...articles.map((a) => ({
        id: a.id,
        title: a.title_ar,
        url: `/blog/${a.slug}`,
        type: 'article',
      })),
    ];

    return results;
  }

  // 3. ADMIN ARTICLES
  async getAdminPosts(params: {
    status?: string;
    categoryId?: string;
    authorId?: string;
    search?: string;
    date?: string;
  }) {
    const where: Record<string, unknown> = {};

    if (params.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params.categoryId && params.categoryId !== 'all') {
      where.category_id = params.categoryId;
    }

    if (params.authorId && params.authorId !== 'all') {
      where.author_id = params.authorId;
    }

    if (params.date) {
      const targetDate = new Date(String(params.date));
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      where.created_at = {
        gte: targetDate,
        lt: nextDate,
      };
    }

    if (params.search) {
      const q = String(params.search).trim();
      where.OR = [
        { title_ar: { contains: q, mode: 'insensitive' } },
        { title_en: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

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

    return {
      posts: formattedPosts,
      counts: {
        all: allCount,
        published: publishedCount,
        draft: draftCount,
        scheduled: scheduledCount,
        trash: trashCount,
      },
    };
  }

  async getAdminPostById(id: string) {
    const post = await prisma.blogPost.findUnique({
      where: { id },
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

    if (!post) return null;

    return {
      ...post,
      tags: post.tags.map((t) => t.tag),
    };
  }

  async createPost(data: any, adminEmail = 'admin') {
    if (!data.title_ar || !data.slug) {
      throw new Error('Arabic title and URL slug are required');
    }

    const cleanSlug = data.slug.trim().toLowerCase();
    const existingSlug = await prisma.blogPost.findUnique({ where: { slug: cleanSlug } });
    if (existingSlug) {
      throw new Error('Slug is already in use by another article');
    }

    let validCategoryId: string | null = null;
    if (data.category_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.category_id);
      if (isUuid) {
        const cat = await prisma.blogCategory.findUnique({ where: { id: data.category_id } });
        if (cat) validCategoryId = cat.id;
      }
    }

    let validAuthorId: string | null = null;
    if (data.author_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.author_id);
      if (isUuid) {
        const auth = await prisma.blogAuthor.findUnique({ where: { id: data.author_id } });
        if (auth) validAuthorId = auth.id;
      }
    }

    const post = await prisma.blogPost.create({
      data: {
        title_ar: data.title_ar,
        title_en: data.title_en || data.title_ar,
        slug: cleanSlug,
        content_html: data.content_html || '',
        content_html_en: data.content_html_en || '',
        content_json: data.content_json || {},
        excerpt_ar: data.excerpt_ar,
        excerpt_en: data.excerpt_en,
        category_id: validCategoryId,
        author_id: validAuthorId,
        featured_image: data.featured_image,
        featured_image_alt: data.featured_image_alt,
        featured_image_caption: data.featured_image_caption,
        focus_keyword: data.focus_keyword,
        meta_title_ar: data.meta_title_ar,
        meta_title_en: data.meta_title_en,
        meta_desc_ar: data.meta_desc_ar,
        meta_desc_en: data.meta_desc_en,
        canonical_url: data.canonical_url,
        robots_index: Boolean(data.robots_index),
        robots_follow: Boolean(data.robots_follow),
        related_post_ids: data.related_post_ids || [],
        status: data.status || 'draft',
        published_at: data.status === 'published' ? new Date() : null,
        scheduled_at: data.status === 'scheduled' && data.scheduled_at ? new Date(data.scheduled_at) : null,
      },
    });

    if (Array.isArray(data.tags) && data.tags.length > 0) {
      for (const tagItem of data.tags) {
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
            data: { post_id: post.id, tag_id: tagId },
          }).catch(() => {});
        }
      }
    }

    await prisma.blogRevision.create({
      data: {
        post_id: post.id,
        content_json: data.content_json || { html: data.content_html },
        created_by: adminEmail,
      },
    });

    if (post.status === 'published') {
      triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    }

    return post;
  }

  async updatePost(id: string, data: any, adminEmail = 'admin') {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Article not found');
    }

    const newSlug = data.slug ? data.slug.trim().toLowerCase() : existing.slug;

    if (newSlug !== existing.slug) {
      const existingWithSlug = await prisma.blogPost.findUnique({ where: { slug: newSlug } });
      if (existingWithSlug && existingWithSlug.id !== existing.id) {
        throw new Error('This URL slug is already taken by another article');
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

    let validCategoryId = existing.category_id;
    if (data.category_id !== undefined) {
      validCategoryId = null;
      if (data.category_id) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.category_id);
        if (isUuid) {
          const cat = await prisma.blogCategory.findUnique({ where: { id: data.category_id } });
          if (cat) validCategoryId = cat.id;
        }
      }
    }

    let validAuthorId = existing.author_id;
    if (data.author_id !== undefined) {
      validAuthorId = null;
      if (data.author_id) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.author_id);
        if (isUuid) {
          const auth = await prisma.blogAuthor.findUnique({ where: { id: data.author_id } });
          if (auth) validAuthorId = auth.id;
        }
      }
    }

    const updated = await prisma.blogPost.update({
      where: { id },
      data: {
        title_ar: data.title_ar ?? existing.title_ar,
        title_en: data.title_en ?? existing.title_en,
        slug: newSlug,
        content_html: data.content_html ?? existing.content_html,
        content_html_en: data.content_html_en ?? existing.content_html_en,
        content_json: data.content_json ?? existing.content_json,
        excerpt_ar: data.excerpt_ar ?? existing.excerpt_ar,
        excerpt_en: data.excerpt_en ?? existing.excerpt_en,
        category_id: validCategoryId,
        author_id: validAuthorId,
        featured_image: data.featured_image ?? existing.featured_image,
        featured_image_alt: data.featured_image_alt ?? existing.featured_image_alt,
        featured_image_caption: data.featured_image_caption ?? existing.featured_image_caption,
        focus_keyword: data.focus_keyword ?? existing.focus_keyword,
        meta_title_ar: data.meta_title_ar ?? existing.meta_title_ar,
        meta_title_en: data.meta_title_en ?? existing.meta_title_en,
        meta_desc_ar: data.meta_desc_ar ?? existing.meta_desc_ar,
        meta_desc_en: data.meta_desc_en ?? existing.meta_desc_en,
        canonical_url: data.canonical_url ?? existing.canonical_url,
        robots_index: data.robots_index !== undefined ? Boolean(data.robots_index) : existing.robots_index,
        robots_follow: data.robots_follow !== undefined ? Boolean(data.robots_follow) : existing.robots_follow,
        related_post_ids: data.related_post_ids ?? existing.related_post_ids,
        status: data.status ?? existing.status,
        published_at:
          data.status === 'published' && !existing.published_at
            ? new Date()
            : existing.published_at,
        scheduled_at:
          data.status === 'scheduled' && data.scheduled_at
            ? new Date(data.scheduled_at)
            : existing.scheduled_at,
      },
    });

    if (Array.isArray(data.tags)) {
      await prisma.blogPostTag.deleteMany({ where: { post_id: existing.id } });
      for (const tagItem of data.tags) {
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

    if (data.content_html || data.content_json) {
      await prisma.blogRevision.create({
        data: {
          post_id: existing.id,
          content_json: data.content_json || { html: data.content_html },
          created_by: adminEmail,
        },
      });
    }

    triggerRevalidation(['blog', `blog:${updated.slug}`, `blog:${existing.slug}`]).catch(() => {});

    return updated;
  }

  async duplicatePost(id: string) {
    const original = await prisma.blogPost.findUnique({
      where: { id },
      include: { tags: true },
    });

    if (!original) throw new Error('Post not found');

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

    for (const tagRel of original.tags) {
      await prisma.blogPostTag.create({
        data: { post_id: copy.id, tag_id: tagRel.tag_id },
      }).catch(() => {});
    }

    return copy;
  }

  async movePostToTrash(id: string) {
    const post = await prisma.blogPost.update({
      where: { id },
      data: { status: 'archived' },
    });
    triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    return post;
  }

  async restorePostFromTrash(id: string) {
    return prisma.blogPost.update({
      where: { id },
      data: { status: 'draft' },
    });
  }

  async deletePost(id: string) {
    const post = await prisma.blogPost.delete({ where: { id } });
    triggerRevalidation(['blog', `blog:${post.slug}`]).catch(() => {});
    return post;
  }

  async bulkActions(ids: string[], action: string, value?: string) {
    if (action === 'delete') {
      await prisma.blogPost.deleteMany({ where: { id: { in: ids } } });
      return { count: ids.length };
    }
    if (action === 'trash') {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: { status: 'archived' },
      });
      return { count: ids.length };
    }
    if (action === 'change_status' && value) {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: {
          status: value as PostStatus,
          published_at: value === 'published' ? new Date() : undefined,
        },
      });
      return { count: ids.length };
    }
    if (action === 'change_category' && value) {
      await prisma.blogPost.updateMany({
        where: { id: { in: ids } },
        data: { category_id: value },
      });
      return { count: ids.length };
    }
    throw new Error('Unsupported bulk action');
  }

  // 4. CATEGORIES ADMIN CRUD
  async getAdminCategories() {
    return prisma.blogCategory.findMany({
      include: {
        parent: { select: { id: true, name_ar: true, name_en: true } },
        children: { select: { id: true, name_ar: true, name_en: true, slug: true } },
        _count: { select: { posts: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createCategory(data: {
    name_ar: string;
    name_en?: string;
    slug: string;
    description_ar?: string;
    description_en?: string;
    parent_id?: string | null;
  }) {
    return prisma.blogCategory.create({
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        slug: data.slug.trim().toLowerCase(),
        description_ar: data.description_ar,
        description_en: data.description_en,
        parent_id: data.parent_id || null,
      },
    });
  }

  async updateCategory(id: string, data: any) {
    return prisma.blogCategory.update({
      where: { id },
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en,
        slug: data.slug?.trim().toLowerCase(),
        description_ar: data.description_ar,
        description_en: data.description_en,
        parent_id: data.parent_id || null,
      },
    });
  }

  async deleteCategory(id: string) {
    return prisma.blogCategory.delete({ where: { id } });
  }

  // 5. TAGS ADMIN CRUD
  async getAdminTags(query?: string) {
    return prisma.blogTag.findMany({
      where: query
        ? {
            OR: [
              { name_ar: { contains: query, mode: 'insensitive' } },
              { name_en: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { _count: { select: { posts: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async createOrUpsertTag(data: { name_ar: string; name_en?: string; slug?: string }) {
    const tagSlug = data.slug
      ? data.slug.trim().toLowerCase()
      : data.name_ar.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-');

    return prisma.blogTag.upsert({
      where: { slug: tagSlug },
      create: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        slug: tagSlug,
      },
      update: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
      },
    });
  }

  async deleteTag(id: string) {
    return prisma.blogTag.delete({ where: { id } });
  }

  // 6. AUTHORS ADMIN CRUD
  async getAdminAuthors() {
    return prisma.blogAuthor.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async createAuthor(data: any) {
    return prisma.blogAuthor.create({
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        slug: data.slug.trim().toLowerCase(),
        avatar_url: data.avatar_url,
        bio_ar: data.bio_ar,
        bio_en: data.bio_en,
        role_title: data.role_title || 'كاتب محتوى',
      },
    });
  }

  async updateAuthor(id: string, data: any) {
    return prisma.blogAuthor.update({
      where: { id },
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en,
        slug: data.slug?.trim().toLowerCase(),
        avatar_url: data.avatar_url,
        bio_ar: data.bio_ar,
        bio_en: data.bio_en,
        role_title: data.role_title,
      },
    });
  }

  async deleteAuthor(id: string) {
    return prisma.blogAuthor.delete({ where: { id } });
  }
}

export const blogService = new BlogService();
