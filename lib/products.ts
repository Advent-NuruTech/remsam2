import "server-only";

import slugify from "slugify";
import { FieldValue, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpError } from "@/lib/auth";
import { firestore } from "@/lib/firestore";
import { richTextToPlainText, sanitizeRichText } from "@/lib/rich-text";
import type { PublicProduct } from "@/lib/types";

const STATUSES = ["active", "inactive", "draft"] as const;
const MAX_IMAGES = 10;
const SALE_TYPES = ["retail", "wholesale"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(
  input: Record<string, unknown>,
  key: string,
  options: { required?: boolean; max?: number } = {},
): string | undefined {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${key} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > (options.max ?? 5000)) {
    throw new HttpError(400, `${key} is too long`);
  }
  return trimmed;
}

function optionalString(input: Record<string, unknown>, key: string, max = 500): string | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") return undefined;
  return stringField(input, key, { max });
}

function richTextField(
  input: Record<string, unknown>,
  key: string,
  options: { required?: boolean; max?: number } = {},
): string | undefined {
  const value = input[key];
  if (value === undefined || value === null || value === "") {
    if (options.required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new HttpError(400, `${key} must be a string`);
  const safe = sanitizeRichText(value);
  const text = richTextToPlainText(safe);
  if (!text.trim()) {
    if (options.required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (text.length > (options.max ?? 10000)) throw new HttpError(400, `${key} is too long`);
  return safe;
}

function numberField(
  input: Record<string, unknown>,
  key: string,
  options: { required?: boolean; integer?: boolean; min?: number } = {},
): number | undefined {
  const value = input[key];
  if (value === undefined || value === null) {
    if (options.required) throw new HttpError(400, `${key} is required`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${key} must be a number`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new HttpError(400, `${key} must be an integer`);
  }
  if (value < (options.min ?? 0)) throw new HttpError(400, `${key} is out of range`);
  return value;
}

function booleanField(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new HttpError(400, `${key} must be a boolean`);
  return value;
}

function imagesField(input: Record<string, unknown>): string[] | undefined {
  const value = input.images;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_IMAGES) {
    throw new HttpError(400, `images must contain at most ${MAX_IMAGES} image URLs`);
  }
  if (value.some((image) => typeof image !== "string" || !image.trim())) {
    throw new HttpError(400, "images must contain only non-empty strings");
  }
  return value.map((image) => (image as string).trim());
}

function specificationsField(input: Record<string, unknown>) {
  const value = input.specifications;
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new HttpError(400, "specifications must be an object");
  const entries = Object.entries(value);
  if (entries.length > 50 || entries.some(([key, item]) => !key.trim() || typeof item !== "string")) {
    throw new HttpError(400, "specifications must contain string values");
  }
  return Object.fromEntries(entries.map(([key, item]) => [key.trim(), (item as string).trim()]));
}

function keywordsField(input: Record<string, unknown>): string[] | undefined {
  const value = input.seoKeywords;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string")) {
    throw new HttpError(400, "seoKeywords must be an array of strings");
  }
  return value.map((item) => (item as string).trim()).filter(Boolean);
}

function variantsField(input: Record<string, unknown>) {
  if (input.variants === undefined) return undefined;
  if (!Array.isArray(input.variants) || input.variants.length > 50) throw new HttpError(400, "At most 50 variants are allowed");
  const variants = input.variants.map((value, index) => {
    if (!isRecord(value)) throw new HttpError(400, `Variant ${index + 1} is invalid`);
    const id = stringField(value, "id", { required: true, max: 100 })!;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new HttpError(400, "Invalid variant ID");
    const name = stringField(value, "name", { required: true, max: 100 })!;
    const price = numberField(value, "price", { required: true, min: 0.01 })!;
    const stockQuantity = numberField(value, "stockQuantity", { required: true, integer: true, min: 0 })!;
    const image = optionalString(value, "image", 2000);
    return { id, name, price, stockQuantity, ...(image ? { image } : {}) };
  });
  if (new Set(variants.map((v) => v.id)).size !== variants.length || new Set(variants.map((v) => v.name.toLowerCase())).size !== variants.length) throw new HttpError(400, "Variant names and IDs must be unique");
  return variants;
}

function wholesaleTiersField(input: Record<string, unknown>) {
  if (input.wholesaleTiers === undefined) return undefined;
  if (!Array.isArray(input.wholesaleTiers) || !input.wholesaleTiers.length || input.wholesaleTiers.length > 20) {
    throw new HttpError(400, "Wholesale products need between 1 and 20 quantity tiers");
  }
  const tiers = input.wholesaleTiers.map((value, index) => {
    if (!isRecord(value)) throw new HttpError(400, `Wholesale tier ${index + 1} is invalid`);
    return {
      minQuantity: numberField(value, "minQuantity", { required: true, integer: true, min: 1 })!,
      price: numberField(value, "price", { required: true, min: 0.01 })!,
    };
  }).sort((left, right) => left.minQuantity - right.minQuantity);
  if (new Set(tiers.map((tier) => tier.minQuantity)).size !== tiers.length) throw new HttpError(400, "Each wholesale quantity tier must start at a different quantity");
  return tiers;
}

export function validateProductBody(value: unknown, partial = false): Record<string, unknown> {
  if (!isRecord(value)) throw new HttpError(400, "A JSON product body is required");

  const name = stringField(value, "name", { required: !partial, max: 160 });
  const description = richTextField(value, "description", { required: !partial, max: 10000 });
  const category = value.category;
  if (category !== undefined && (typeof category !== "string" || !category.trim())) {
    throw new HttpError(400, "category must be a non-empty string");
  }
  const status = value.status;
  if (status !== undefined && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new HttpError(400, "status must be active, inactive or draft");
  }
  const saleType = value.saleType;
  if (saleType !== undefined && !SALE_TYPES.includes(saleType as (typeof SALE_TYPES)[number])) {
    throw new HttpError(400, "saleType must be retail or wholesale");
  }

  const result: Record<string, unknown> = {};
  const assign = (key: string, next: unknown) => {
    if (next !== undefined) result[key] = next;
  };

  const variants = variantsField(value);
  const wholesaleTiers = wholesaleTiersField(value);
  assign("variants", variants);
  assign("saleType", saleType);
  assign("wholesaleTiers", wholesaleTiers);
  assign("name", name);
  assign("description", description);
  assign("features", richTextField(value, "features", { max: 10000 }));
  assign("category", typeof category === "string" ? category.trim() : category);
  assign("price", numberField(value, "price", { required: !partial && !variants?.length, min: 0.01 }));
  assign("originalPrice", numberField(value, "originalPrice", { min: 0 }));
  assign("images", imagesField(value));
  assign("inStock", booleanField(value, "inStock"));
  assign("stockQuantity", numberField(value, "stockQuantity", { integer: true, min: 0 }));
  assign("specifications", specificationsField(value));
  assign("brand", optionalString(value, "brand", 160));
  assign("model", optionalString(value, "model", 160));
  assign("featured", booleanField(value, "featured"));
  assign("seoTitle", optionalString(value, "seoTitle", 160));
  assign("seoDescription", optionalString(value, "seoDescription", 500));
  assign("seoKeywords", keywordsField(value));
  assign("status", status);
  assign("organicCertified", booleanField(value, "organicCertified"));
  assign("seedType", optionalString(value, "seedType", 160));

  if (value.harvestDate !== undefined) {
    if (value.harvestDate !== null && typeof value.harvestDate !== "string") {
      throw new HttpError(400, "harvestDate must be an ISO date string or null");
    }
    if (typeof value.harvestDate === "string" && Number.isNaN(Date.parse(value.harvestDate))) {
      throw new HttpError(400, "harvestDate must be a valid date");
    }
    result.harvestDate = value.harvestDate;
  }

  if (variants?.length) {
    result.price = Math.min(...variants.map((v) => v.price));
    result.stockQuantity = variants.reduce((sum, v) => sum + v.stockQuantity, 0);
    result.inStock = variants.some((v) => v.stockQuantity > 0);
  }
  if ((saleType === "wholesale" || (!partial && saleType === "wholesale")) && !wholesaleTiers?.length) {
    throw new HttpError(400, "Wholesale products need at least one quantity tier");
  }
  if (wholesaleTiers?.length) result.price = wholesaleTiers[0].price;
  if (partial && Object.keys(result).length === 0) {
    throw new HttpError(400, "No supported product fields were provided");
  }

  if (!partial) {
    result.category ??= "seeds";
    result.images ??= [];
    result.inStock ??= true;
    result.stockQuantity ??= 0;
    result.specifications ??= {};
    result.featured ??= false;
    result.status ??= "active";
    result.saleType ??= "retail";
    result.organicCertified ??= false;
    result.seoKeywords ??= [];
    result.seoTitle ??= name;
    result.seoDescription ??= description ? richTextToPlainText(description).slice(0, 160) : undefined;
  }

  return result;
}

export function productSlug(name: string): string {
  const slug = slugify(name, { lower: true, strict: true });
  if (!slug) throw new HttpError(400, "name must contain letters or numbers");
  return slug;
}

export async function assertUniqueProductSlug(slug: string, excludingId?: string) {
  const snapshot = await firestore().collection("products").where("slug", "==", slug).limit(2).get();
  if (snapshot.docs.some((document) => document.id !== excludingId)) {
    throw new HttpError(409, "A product with this name already exists");
  }
}

export function serializeValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
  }
  return value;
}

export function serializeProduct(document: DocumentSnapshot<DocumentData>): PublicProduct {
  return serializeValue({ _id: document.id, id: document.id, ...document.data() }) as PublicProduct;
}

export function withCreateTimestamps(data: Record<string, unknown>) {
  return { ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
}

export function withUpdateTimestamp(data: Record<string, unknown>) {
  return { ...data, updatedAt: FieldValue.serverTimestamp() };
}
