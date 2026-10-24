import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { blogController } from './blog.controller';

const router = Router();

// ==========================================
// 1. PUBLIC ENDPOINTS
// ==========================================

// GET /api/v1/blog/posts - Public posts listing
router.get('/posts', (req, res) => blogController.getPublicPosts(req, res));

// GET /api/v1/blog/posts/:slug - Public single post by slug
router.get('/posts/:slug', (req, res) => blogController.getPublicPostBySlug(req, res));

// GET /api/v1/blog/categories - Public categories
router.get('/categories', (req, res) => blogController.getPublicCategories(req, res));

// GET /api/v1/blog/tags - Public tags
router.get('/tags', (req, res) => blogController.getPublicTags(req, res));

// GET /api/v1/blog/authors - Public authors
router.get('/authors', (req, res) => blogController.getPublicAuthors(req, res));

// GET /api/v1/blog/internal-links - Search internal site routes & posts for Link Picker
router.get('/internal-links', (req, res) => blogController.searchInternalLinks(req, res));

// ==========================================
// 2. ADMIN ARTICLES MANAGEMENT
// ==========================================

// GET /api/v1/blog/admin/all - Admin posts with counts by status, filters & search
router.get('/admin/all', requireAuth, (req, res) => blogController.getAdminPosts(req, res));

// GET /api/v1/blog/admin/posts/:id - Full article by ID for editing
router.get('/admin/posts/:id', requireAuth, (req, res) => blogController.getAdminPostById(req, res));

// POST /api/v1/blog/admin/posts - Create new article
router.post('/admin/posts', requireAuth, (req, res) => blogController.createPost(req, res));

// PUT /api/v1/blog/admin/posts/:id - Update article
router.put('/admin/posts/:id', requireAuth, (req, res) => blogController.updatePost(req, res));

// POST /api/v1/blog/admin/posts/:id/duplicate - Duplicate post as draft
router.post('/admin/posts/:id/duplicate', requireAuth, (req, res) => blogController.duplicatePost(req, res));

// PATCH /api/v1/blog/admin/posts/:id/trash - Move to Trash
router.patch('/admin/posts/:id/trash', requireAuth, (req, res) => blogController.movePostToTrash(req, res));

// PATCH /api/v1/blog/admin/posts/:id/restore - Restore from Trash
router.patch('/admin/posts/:id/restore', requireAuth, (req, res) => blogController.restorePost(req, res));

// DELETE /api/v1/blog/admin/posts/:id - Permanently Delete
router.delete('/admin/posts/:id', requireAuth, (req, res) => blogController.deletePost(req, res));

// PATCH /api/v1/blog/admin/bulk - Bulk actions
router.patch('/admin/bulk', requireAuth, (req, res) => blogController.bulkActions(req, res));

// ==========================================
// 3. CATEGORIES CRUD
// ==========================================

// GET /api/v1/blog/admin/categories
router.get('/admin/categories', requireAuth, (req, res) => blogController.getAdminCategories(req, res));

// POST /api/v1/blog/admin/categories
router.post('/admin/categories', requireAuth, (req, res) => blogController.createCategory(req, res));

// PUT /api/v1/blog/admin/categories/:id
router.put('/admin/categories/:id', requireAuth, (req, res) => blogController.updateCategory(req, res));

// DELETE /api/v1/blog/admin/categories/:id
router.delete('/admin/categories/:id', requireAuth, (req, res) => blogController.deleteCategory(req, res));

// ==========================================
// 4. TAGS CRUD
// ==========================================

// GET /api/v1/blog/admin/tags
router.get('/admin/tags', requireAuth, (req, res) => blogController.getAdminTags(req, res));

// POST /api/v1/blog/admin/tags
router.post('/admin/tags', requireAuth, (req, res) => blogController.createTag(req, res));

// DELETE /api/v1/blog/admin/tags/:id
router.delete('/admin/tags/:id', requireAuth, (req, res) => blogController.deleteTag(req, res));

// ==========================================
// 5. AUTHORS CRUD
// ==========================================

// GET /api/v1/blog/admin/authors
router.get('/admin/authors', requireAuth, (req, res) => blogController.getAdminAuthors(req, res));

// POST /api/v1/blog/admin/authors
router.post('/admin/authors', requireAuth, (req, res) => blogController.createAuthor(req, res));

// PUT /api/v1/blog/admin/authors/:id
router.put('/admin/authors/:id', requireAuth, (req, res) => blogController.updateAuthor(req, res));

// DELETE /api/v1/blog/admin/authors/:id
router.delete('/admin/authors/:id', requireAuth, (req, res) => blogController.deleteAuthor(req, res));

export default router;
