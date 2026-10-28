import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function credential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase Admin credentials are missing");
  return { projectId, clientEmail, privateKey };
}

const accountId = process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const databaseId = process.env.D1_DATABASE_ID;
const apiToken = process.env.CF_API_TOKEN || process.env.R2_API_TOKEN;
if (!accountId || !databaseId || !apiToken) throw new Error("Cloudflare D1 credentials are missing");

const serviceAccount = credential();
const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.projectId });
const db = getFirestore(app);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
const syncState = (area, dirty) => db.collection("systemState").doc(`d1-public-${area}`).set({
  dirty,
  updatedAt: new Date(),
}, { merge: true });

async function query(sql, params = []) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const json = await response.json();
  if (!response.ok || !json.success || json.result?.some((item) => !item.success)) {
    throw new Error(json.errors?.map((item) => item.message).join("; ") || `D1 query failed (${response.status})`);
  }
}

async function batch(statements) {
  if (!statements.length) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ batch: statements }),
  });
  const json = await response.json();
  if (!response.ok || !json.success || json.result?.some((item) => !item.success)) {
    throw new Error(json.errors?.map((item) => item.message).join("; ") || `D1 batch failed (${response.status})`);
  }
}

function iso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return null;
}

const articleSql = `INSERT INTO public_articles (
  id, slug, title, excerpt, featured_image, legacy_category, legacy_study_category,
  major_category_id, subcategory_id, tags_json, author_json, seo_title, seo_description,
  seo_keywords_json, published_at, views, is_downloadable, file_key, file_name, file_type,
  created_at, updated_at
) VALUES (${Array.from({ length: 22 }, () => "?").join(",")})`;
const productSql = `INSERT INTO public_products (
  id, slug, name, description, features, category, price, original_price, images_json,
  in_stock, stock_quantity, specifications_json, brand, model, featured, seo_title,
  seo_description, seo_keywords_json, organic_certified, harvest_date, seed_type,
  created_at, updated_at
) VALUES (${Array.from({ length: 23 }, () => "?").join(",")})`;

await Promise.all([syncState("articles", true), syncState("products", true)]);
await query("INSERT INTO public_read_model_state(area, ready) VALUES ('articles', 0), ('products', 0) ON CONFLICT(area) DO UPDATE SET ready=0, updated_at=datetime('now')");
const [articles, products] = await Promise.all([
  db.collection("articles").where("published", "==", true).get(),
  db.collection("products").where("status", "==", "active").get(),
]);
await query("DELETE FROM public_articles");
await query("DELETE FROM public_products");

const articleStatements = articles.docs.map((document) => {
  const item = document.data();
  return { sql: articleSql, params: [
    document.id, item.slug, item.title, item.excerpt, item.featuredImage || null,
    item.category || null, item.studyCategory || null,
    item.majorCategoryId || (item.isDownloadable || item.category === "study" ? "study-library" : "articles-blogs"),
    item.subcategoryId || null, JSON.stringify(item.tags || []), JSON.stringify(item.author || {}),
    item.seoTitle || null, item.seoDescription || null, JSON.stringify(item.seoKeywords || []),
    iso(item.publishedAt), Number(item.views || 0), item.isDownloadable ? 1 : 0,
    item.fileKey || null, item.fileName || null, item.fileType || null, iso(item.createdAt), iso(item.updatedAt),
  ] };
});
const productStatements = products.docs.map((document) => {
  const item = document.data();
  return { sql: productSql, params: [
    document.id, item.slug, item.name, item.description, item.features || null, item.category,
    Number(item.price), item.originalPrice == null ? null : Number(item.originalPrice),
    JSON.stringify(item.images || []), item.inStock ? 1 : 0, Number(item.stockQuantity || 0),
    JSON.stringify({ ...(item.specifications || {}), __variants: item.variants || [], __saleType: item.saleType || "retail", __wholesaleTiers: item.wholesaleTiers || [] }), item.brand || null, item.model || null,
    item.featured ? 1 : 0, item.seoTitle || null, item.seoDescription || null,
    JSON.stringify(item.seoKeywords || []), item.organicCertified ? 1 : 0,
    iso(item.harvestDate), item.seedType || null, iso(item.createdAt), iso(item.updatedAt),
  ] };
});

for (let index = 0; index < articleStatements.length; index += 100) await batch(articleStatements.slice(index, index + 100));
for (let index = 0; index < productStatements.length; index += 100) await batch(productStatements.slice(index, index + 100));
await query("UPDATE public_read_model_state SET ready=1, updated_at=datetime('now') WHERE area IN ('articles','products')");
await Promise.all([syncState("articles", false), syncState("products", false)]);
console.log(`D1 public read model synchronized: ${articles.size} articles, ${products.size} products.`);
