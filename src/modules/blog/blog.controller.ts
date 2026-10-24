import { Request, Response } from 'express';
import { blogService } from './blog.service';
import { AuthenticatedRequest } from '../auth/auth.middleware';

export class BlogController {
  // 1. PUBLIC POSTS
  async getPublicPosts(req: Request, res: Response) {
    try {
      const { category, tag, author, search, page, limit } = req.query;
      const result = await blogService.getPublicPosts({
        category: category ? String(category) : undefined,
        tag: tag ? String(tag) : undefined,
        author: author ? String(author) : undefined,
        search: search ? String(search) : undefined,
        page: page ? parseInt(String(page), 10) : undefined,
        limit: limit ? parseInt(String(limit), 10) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
  }

  async getPublicPostBySlug(req: Request, res: Response) {
    try {
      const slug = req.params.slug;
      const post = await blogService.getPublicPostBySlug(slug);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      if ('redirect' in post) {
        return res.status(301).json({ redirect: post.redirect, statusCode: 301 });
      }

      if ('notPublished' in post) {
        return res.status(404).json({ error: 'Post not published' });
      }

      res.json(post);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  }

  async getPublicCategories(_req: Request, res: Response) {
    try {
      const categories = await blogService.getPublicCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }

  async getPublicTags(_req: Request, res: Response) {
    try {
      const tags = await blogService.getPublicTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  }

  async getPublicAuthors(_req: Request, res: Response) {
    try {
      const authors = await blogService.getPublicAuthors();
      res.json(authors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch authors' });
    }
  }

  async searchInternalLinks(req: Request, res: Response) {
    try {
      const query = String(req.query.q || '');
      const results = await blogService.searchInternalLinks(query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: 'Failed to search internal links' });
    }
  }

  // 2. ADMIN POSTS
  async getAdminPosts(req: Request, res: Response) {
    try {
      const { status, categoryId, authorId, search, date } = req.query;
      const result = await blogService.getAdminPosts({
        status: status ? String(status) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        authorId: authorId ? String(authorId) : undefined,
        search: search ? String(search) : undefined,
        date: date ? String(date) : undefined,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admin posts' });
    }
  }

  async getAdminPostById(req: Request, res: Response) {
    try {
      const post = await blogService.getAdminPostById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      res.json(post);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  }

  async createPost(req: AuthenticatedRequest, res: Response) {
    try {
      const post = await blogService.createPost(req.body, req.user?.email);
      res.status(201).json(post);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create post' });
    }
  }

  async updatePost(req: AuthenticatedRequest, res: Response) {
    try {
      const updated = await blogService.updatePost(req.params.id, req.body, req.user?.email);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update post' });
    }
  }

  async duplicatePost(req: AuthenticatedRequest, res: Response) {
    try {
      const copy = await blogService.duplicatePost(req.params.id);
      res.status(201).json(copy);
    } catch (error: any) {
      res.status(error.message.includes('not found') ? 404 : 500).json({
        error: error.message || 'Failed to duplicate post',
      });
    }
  }

  async movePostToTrash(req: AuthenticatedRequest, res: Response) {
    try {
      const post = await blogService.movePostToTrash(req.params.id);
      res.json({ success: true, post });
    } catch (error) {
      res.status(500).json({ error: 'Failed to move to trash' });
    }
  }

  async restorePost(req: AuthenticatedRequest, res: Response) {
    try {
      const post = await blogService.restorePostFromTrash(req.params.id);
      res.json({ success: true, post });
    } catch (error) {
      res.status(500).json({ error: 'Failed to restore article' });
    }
  }

  async deletePost(req: AuthenticatedRequest, res: Response) {
    try {
      await blogService.deletePost(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete post' });
    }
  }

  async bulkActions(req: AuthenticatedRequest, res: Response) {
    try {
      const { ids, action, value } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of post IDs is required' });
      }
      const result = await blogService.bulkActions(ids, action, value);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Bulk action failed' });
    }
  }

  // 3. CATEGORIES CRUD
  async getAdminCategories(_req: Request, res: Response) {
    try {
      const categories = await blogService.getAdminCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }

  async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const category = await blogService.createCategory(req.body);
      res.status(201).json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create category' });
    }
  }

  async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const category = await blogService.updateCategory(req.params.id, req.body);
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update category' });
    }
  }

  async deleteCategory(req: Request, res: Response) {
    try {
      await blogService.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete category' });
    }
  }

  // 4. TAGS CRUD
  async getAdminTags(req: Request, res: Response) {
    try {
      const query = req.query.q ? String(req.query.q) : undefined;
      const tags = await blogService.getAdminTags(query);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  }

  async createTag(req: AuthenticatedRequest, res: Response) {
    try {
      const tag = await blogService.createOrUpsertTag(req.body);
      res.status(201).json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create tag' });
    }
  }

  async deleteTag(req: Request, res: Response) {
    try {
      await blogService.deleteTag(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete tag' });
    }
  }

  // 5. AUTHORS CRUD
  async getAdminAuthors(_req: Request, res: Response) {
    try {
      const authors = await blogService.getAdminAuthors();
      res.json(authors);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch authors' });
    }
  }

  async createAuthor(req: AuthenticatedRequest, res: Response) {
    try {
      const author = await blogService.createAuthor(req.body);
      res.status(201).json(author);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create author' });
    }
  }

  async updateAuthor(req: AuthenticatedRequest, res: Response) {
    try {
      const author = await blogService.updateAuthor(req.params.id, req.body);
      res.json(author);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update author' });
    }
  }

  async deleteAuthor(req: Request, res: Response) {
    try {
      await blogService.deleteAuthor(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to delete author' });
    }
  }
}

export const blogController = new BlogController();
