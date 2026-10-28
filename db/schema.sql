-- D1 stores article bodies and the indexed public read models for articles and
-- products. Firestore remains authoritative for auth, taxonomy administration,
-- inventory, orders, contacts and donations. Images live in Cloudinary and
-- downloadable documents live in R2.
-- Apply with: node --env-file=.env.local scripts/d1-migrate.mjs

CREATE TABLE IF NOT EXISTS article_content (
  article_id  TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS public_articles (
  id                 TEXT PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  excerpt            TEXT NOT NULL,
  featured_image     TEXT,
  legacy_category    TEXT,
  legacy_study_category TEXT,
  major_category_id  TEXT NOT NULL,
  subcategory_id     TEXT,
  tags_json          TEXT NOT NULL DEFAULT '[]',
  author_json        TEXT NOT NULL DEFAULT '{}',
  seo_title          TEXT,
  seo_description    TEXT,
  seo_keywords_json  TEXT NOT NULL DEFAULT '[]',
  published_at       TEXT,
  views              INTEGER NOT NULL DEFAULT 0,
  is_downloadable    INTEGER NOT NULL DEFAULT 0,
  file_key           TEXT,
  file_name          TEXT,
  file_type          TEXT,
  created_at         TEXT,
  updated_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_public_articles_published
  ON public_articles(published_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_public_articles_major
  ON public_articles(major_category_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_articles_subcategory
  ON public_articles(subcategory_id, published_at DESC);

-- Matches the public listing order, including older resources without published_at.
CREATE INDEX IF NOT EXISTS idx_public_articles_effective_date
  ON public_articles(COALESCE(published_at, created_at) DESC, id);
CREATE INDEX IF NOT EXISTS idx_public_articles_major_effective_date
  ON public_articles(major_category_id, COALESCE(published_at, created_at) DESC, id);
CREATE INDEX IF NOT EXISTS idx_public_articles_sub_effective_date
  ON public_articles(subcategory_id, COALESCE(published_at, created_at) DESC, id);

CREATE TABLE IF NOT EXISTS public_products (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL,
  features            TEXT,
  category            TEXT NOT NULL,
  price               REAL NOT NULL,
  original_price      REAL,
  images_json         TEXT NOT NULL DEFAULT '[]',
  in_stock            INTEGER NOT NULL DEFAULT 0,
  stock_quantity      INTEGER NOT NULL DEFAULT 0,
  specifications_json TEXT NOT NULL DEFAULT '{}',
  brand               TEXT,
  model               TEXT,
  featured            INTEGER NOT NULL DEFAULT 0,
  seo_title           TEXT,
  seo_description     TEXT,
  seo_keywords_json   TEXT NOT NULL DEFAULT '[]',
  organic_certified   INTEGER NOT NULL DEFAULT 0,
  harvest_date        TEXT,
  seed_type           TEXT,
  created_at          TEXT,
  updated_at          TEXT
);

CREATE INDEX IF NOT EXISTS idx_public_products_category
  ON public_products(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_products_featured
  ON public_products(featured, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_products_created
  ON public_products(created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_public_products_featured_category
  ON public_products(category, featured, created_at DESC, id);

CREATE TABLE IF NOT EXISTS public_read_model_state (
  area        TEXT PRIMARY KEY,
  ready       INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Admin release notes are stored directly in D1, independent of the public read model.
CREATE TABLE IF NOT EXISTS admin_updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_updates_created ON admin_updates(created_at DESC, id DESC);

-- Record one-time seeds so a deleted or edited update is not restored on migration.
CREATE TABLE IF NOT EXISTS admin_update_seeds (id TEXT PRIMARY KEY);

INSERT OR IGNORE INTO admin_updates (id, title, content)
  SELECT 'authors-management', 'Create and edit authors', '<p>You can now add and edit author profiles, including their biographies.</p><p>Open Authors in the admin menu to manage profiles, then select an author when creating or editing a resource.</p>'
  WHERE NOT EXISTS (SELECT 1 FROM admin_update_seeds WHERE id = 'authors-management');

INSERT OR IGNORE INTO admin_update_seeds (id) VALUES ('authors-management');

INSERT OR IGNORE INTO admin_updates (id, title, content)
  SELECT 'practical-christianity', 'Practical Christianity pathway is live', '<p>Visitors can now explore the four practical-life pathways, choose a skill area, and send an enquiry to learn, volunteer, find mentorship, or support an initiative.</p><p>Open <strong>Life Skills</strong> in the admin menu to review enquiries, contact each person, and update their follow-up status.</p>'
  WHERE NOT EXISTS (SELECT 1 FROM admin_update_seeds WHERE id = 'practical-christianity');

INSERT OR IGNORE INTO admin_update_seeds (id) VALUES ('practical-christianity');

INSERT OR IGNORE INTO admin_updates (id, title, content)
  SELECT 'paystack-secure-checkout', 'Secure Paystack checkout is live', '<p>Customers now complete product payments through secure Paystack checkout. Product totals are verified on the server before payment is accepted.</p><p>Delivery fees remain separate. RemSam can confirm the parcel fee directly with each customer after payment.</p>'
  WHERE NOT EXISTS (SELECT 1 FROM admin_update_seeds WHERE id = 'paystack-secure-checkout');

INSERT OR IGNORE INTO admin_update_seeds (id) VALUES ('paystack-secure-checkout');
