import { FieldValue } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth";
import { PUBLIC_CACHE_CONTROL, PUBLIC_PRODUCTS_TAG } from "@/lib/cache-tags";
import {
  beginD1ReadModelUpdate,
  deleteD1Product,
  markD1ReadModelReady,
  syncD1ProductDocument,
} from "@/lib/d1-public-store";
import { firestore } from "@/lib/firestore";
import { getCachedActiveProductBySlug } from "@/lib/public-content";
import { managedImageIdFromUrl } from "@/lib/managed-images";
import { deleteManagedImage, imageIsReferenced } from "@/lib/managed-images-server";
import {
  assertUniqueProductSlug,
  productSlug,
  serializeProduct,
  validateProductBody,
  withUpdateTimestamp,
} from "@/lib/products";
import { validateProductCategory } from "@/lib/product-categories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    const { identifier } = await params;
    const product = await getCachedActiveProductBySlug(identifier);
    if (!product) {
      throw new HttpError(404, "Product not found");
    }
    return NextResponse.json(product, { headers: { "Cache-Control": PUBLIC_CACHE_CONTROL } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    await requireAdmin(request);
    const { identifier } = await params;
    const reference = firestore().collection("products").doc(identifier);
    const existing = await reference.get();
    if (!existing.exists) throw new HttpError(404, "Product not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "A valid JSON product body is required");
    }
    const data = validateProductBody(body, true);
    await validateProductCategory(data, existing.data());
    const input = body as Record<string, unknown>;
    for (const key of ["features", "brand", "model", "seoTitle", "seoDescription", "seedType"] as const) {
      if (key in input && (input[key] === "" || input[key] === null)) data[key] = FieldValue.delete();
    }
    if ("originalPrice" in input && input.originalPrice === null) data.originalPrice = FieldValue.delete();
    if (data.saleType === "retail") data.wholesaleTiers = FieldValue.delete();
    if (typeof data.name === "string") {
      const slug = productSlug(data.name);
      await assertUniqueProductSlug(slug, identifier);
      data.slug = slug;
    }
    const syncD1 = await beginD1ReadModelUpdate("products");
    let updated;
    let applied = false;
    try {
      await firestore().runTransaction(async (transaction) => {
        const current = await transaction.get(reference);
        if (!current.exists) throw new HttpError(404, "Product not found");
        const expected = input.expectedInventory as { stockQuantity?: number; variants?: Array<{ id: string; stockQuantity: number }> } | undefined;
        if (expected) {
          const currentData = current.data() ?? {};
          const stock = (currentData.variants ?? []).map((v: { id: string; stockQuantity: number }) => ({ id: v.id, stockQuantity: v.stockQuantity }));
          if (currentData.stockQuantity !== expected.stockQuantity || JSON.stringify(stock) !== JSON.stringify(expected.variants ?? [])) throw new HttpError(409, "Stock changed while you were editing. Reopen the product to see the latest stock.");
        }
        transaction.update(reference, withUpdateTimestamp(data));
      });
      applied = true;
      updated = await reference.get();
      if (syncD1) {
        await syncD1ProductDocument(updated);
        await markD1ReadModelReady("products");
      }
    } catch (error) {
      if (!applied) {
        if (syncD1) await markD1ReadModelReady("products").catch(() => undefined);
        throw error;
      }
      try {
        await reference.set(existing.data() ?? {});
        if (syncD1) {
          await syncD1ProductDocument(existing);
          await markD1ReadModelReady("products");
        }
      } catch (rollbackError) {
        throw new Error(
          `Product update failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown rollback error"}`,
          { cause: error },
        );
      }
      throw error;
    }
    revalidateTag(PUBLIC_PRODUCTS_TAG, { expire: 0 });
    return NextResponse.json(serializeProduct(updated));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> },
) {
  try {
    await requireAdmin(request);
    const { identifier } = await params;
    const reference = firestore().collection("products").doc(identifier);
    const existing = await reference.get();
    if (!existing.exists) throw new HttpError(404, "Product not found");
    const existingData = existing.data() ?? {};
    const images = Array.isArray(existingData.images) ? existingData.images : [];
    const variants = Array.isArray(existingData.variants) ? existingData.variants : [];
    const imageIds = new Set<string>([...images, ...variants.map((variant: { image?: unknown }) => variant?.image)]
      .filter((image): image is string => typeof image === "string")
      .map(managedImageIdFromUrl).filter((id): id is string => Boolean(id)));
    for (const id of imageIds) {
      if (!(await imageIsReferenced(id, undefined, identifier))) await deleteManagedImage(id);
    }
    const syncD1 = await beginD1ReadModelUpdate("products");
    try {
      await reference.delete();
      if (syncD1) {
        await deleteD1Product(identifier);
        await markD1ReadModelReady("products");
      }
    } catch (error) {
      try {
        await reference.set(existing.data() ?? {});
        if (syncD1) {
          await syncD1ProductDocument(existing);
          await markD1ReadModelReady("products");
        }
      } catch (rollbackError) {
        throw new Error(
          `Product deletion failed and rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown rollback error"}`,
          { cause: error },
        );
      }
      throw error;
    }
    revalidateTag(PUBLIC_PRODUCTS_TAG, { expire: 0 });
    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error) {
    return errorResponse(error);
  }
}
