# Journal and blog administration

The public journal is `/blog`; `/blogs` redirects there. Published stories have `/blog/<slug>` URLs, article metadata, social preview images, structured data and sitemap entries. The journal supports category filtering, search, an editor’s pick and more-story pagination. No sample articles are published automatically. An empty journal invites visitors to explore the wedding collection.

## One-time database setup

Run `supabase/migrations/20260922_blog_posts.sql` in the **Supabase SQL editor** as the database owner. This creates `blog_posts` with publication-based read policies and the public `blog_images` bucket. Public/anonymous and signed-in customer roles can only read published articles whose publication date has arrived. They have no direct database write privileges. Drafts are excluded from article URLs and sitemaps.

The application uses the existing `NEXT_PUBLIC_SUPABASE_URL`, public anonymous/publishable key, and server-only `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`). No new application secrets are needed. Storefront blog reads use the public role and row-level security. Admin writes use the existing server-only client.

**Admin access follows the existing, intentionally deferred authentication policy documented in `ADMIN_ITEMS.md`.** `/admin/blogs` and `/api/admin/blogs*` currently have no authentication. Same-origin write checks and noindex headers are present but do not restrict who can administer blogs. Apply the future admin permission check to the blog list, editor, read/write API and image API alongside the item routes.

## Write and publish

1. Open `/admin`, select **Blogs**, then **Add blog**.
2. Enter a title and the **Author name** directly below it. New articles start with a blank author field; enter the name to display in the preview, blog listing and article byline. Existing articles retain their saved author, which you can edit here. The URL slug fills automatically until manually edited. Choose a category, then add a short introduction and Markdown content.
3. Use the toolbar for headings, bold, italics, quotes, lists, links, dividers and images. **Preview** renders the same Markdown component as the public article. GitHub-style tables and task lists are supported. Raw HTML is not rendered and unsafe URL schemes are blocked.
4. Upload a cover photo, or supply an HTTPS image URL. Enter a meaningful image description. Use **Insert image** in the content toolbar for uploaded or linked inline images with alt text. Remove/replace a cover with its controls; edit or remove inline image Markdown in the text.
5. **Save draft** keeps the story in admin. Publishing requires a title, valid unique slug, author, introduction and content. A cover is optional; article cards use a branded placeholder when absent.
6. Choose **Publish article**, then **Publish now**. The story appears immediately. Check **Feature this story** to make it eligible for the leading editor’s pick; the most recently published featured story is selected, falling back to the latest article.

Reopen an article to edit it. **Save changes** updates a published article; **Move to drafts** removes it from public pages. Changing a published slug breaks its former URL. Original publication dates survive edits and unpublishing. Unsaved edits prompt before leaving via editor navigation or closing the tab. `Ctrl/Cmd+S` saves and `Ctrl/Cmd+B/I` formats selected text.

## Persistence and images

`GET /api/admin/blogs` lists summaries; `?id=<uuid>` loads one complete article. `POST` creates with a stable client-generated UUID; `PATCH` checks the last saved timestamp to reject stale edits. Slugs are unique in PostgreSQL. A lost creation response can be safely retried with the same UUID and content. Request streams have byte limits even without Content-Length. Reads/writes have deadlines and retry states.

`POST /api/admin/blogs/images` accepts an `image` multipart field. The browser accepts JPG, PNG and WebP originals up to 20 MB, resizing them before the server’s 3 MB limit. The server decodes and validates raster content, strips metadata, orients it and stores a WebP image up to 1,800 pixels. Animated/malformed images and SVG uploads are rejected. Storage paths are UUIDs, and uploads do not overwrite existing files.

Images upload when selected and are public, including images used in drafts. Removing or replacing an image detaches it from the article; it does not delete the stored object because another article may reference it. Abandoned uploads can therefore leave unused objects for later cleanup. Unsaved article text remains in the open editor after errors; it is not automatically backed up across tab closure.

## Validation

Run the focused blog tests with `node --test tests/blog.test.cjs tests/blog-database.test.cjs tests/blog-editor.test.cjs`. Type-check with `npx tsc --noEmit`; use ESLint on the changed files. A production build is not required for normal blog editing or development checks.
