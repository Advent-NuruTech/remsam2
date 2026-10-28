import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { FieldValue, type DocumentData, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { HttpError } from "@/lib/auth";
import { PUBLIC_PRODUCTS_TAG } from "@/lib/cache-tags";
import { beginD1ReadModelUpdate, markD1ReadModelReady, syncD1ProductDocument } from "@/lib/d1-public-store";
import { firestore } from "@/lib/firestore";
import { notifyAdmins, notifyUser } from "@/lib/notifications";
import { sendOrderConfirmation } from "@/lib/order-confirmation-email";
import { createOrderNumber, orderTimestamps, serializeOrder, type ValidatedOrderInput, validateOrderBody } from "@/lib/orders";
import { initializePaystackPayment, isPaystackReference, verifyPaystackPayment } from "@/lib/paystack";
import type { AppUser, OrderItem, PublicOrder } from "@/lib/types";

type CheckoutInput = ValidatedOrderInput & { idempotencyKey: string };
type StockVariant = { id: string; name: string; price: number; stockQuantity: number; image?: string };
type ProductUpdate = { variants?: StockVariant[]; stockQuantity: number };
type Quote = { items: OrderItem[]; updates: Map<string, ProductUpdate>; subtotalMinor: number };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function positiveMinorAmount(value: number, label: string) {
  const minor = Math.round(value * 100);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(minor) || Math.abs(value * 100 - minor) > 0.000001) {
    throw new HttpError(400, `${label} has an invalid price`);
  }
  return minor;
}

function normalizeVariants(value: unknown): StockVariant[] {
  if (!Array.isArray(value)) return [];
  return value.map((variant) => {
    if (!record(variant) || typeof variant.id !== "string" || typeof variant.name !== "string" || typeof variant.price !== "number" || typeof variant.stockQuantity !== "number") {
      throw new HttpError(400, "A product option is invalid");
    }
    return {
      id: variant.id,
      name: variant.name,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      ...(typeof variant.image === "string" ? { image: variant.image } : {}),
    };
  });
}

function quoteOrder(input: ValidatedOrderInput, documents: Map<string, DocumentSnapshot<DocumentData>>): Quote {
  const updates = new Map<string, ProductUpdate>();
  let subtotalMinor = 0;
  const items = input.items.map((requested) => {
    const product = documents.get(requested.product);
    if (!product?.exists) throw new HttpError(400, "A product in your cart was not found");
    const data = product.data() ?? {};
    if (data.status !== "active") throw new HttpError(400, `Product ${String(data.name)} is unavailable`);
    const sourceVariants = normalizeVariants(data.variants);
    const update = updates.get(product.id) ?? {
      ...(sourceVariants.length ? { variants: sourceVariants.map((variant) => ({ ...variant })) } : {}),
      stockQuantity: Number(data.stockQuantity ?? 0),
    };
    const variant = update.variants?.find((item) => item.id === requested.variantId);
    if ((update.variants && !variant) || (!update.variants && requested.variantId)) {
      throw new HttpError(400, `Please select an available option for ${String(data.name)}`);
    }
    const available = variant ? variant.stockQuantity : update.stockQuantity;
    if ((!variant && data.inStock !== true) || !Number.isInteger(available) || available < requested.quantity) {
      throw new HttpError(400, `Insufficient stock for ${String(data.name)}${variant ? ` (${variant.name})` : ""}`);
    }
    const unitMinor = positiveMinorAmount(Number(variant ? variant.price : data.price), String(data.name ?? "Product"));
    if (variant) variant.stockQuantity -= requested.quantity;
    else update.stockQuantity -= requested.quantity;
    updates.set(product.id, update);
    subtotalMinor += unitMinor * requested.quantity;
    return {
      product: product.id,
      ...(variant ? { variantId: variant.id, variantName: variant.name } : {}),
      name: String(data.name ?? "Product"),
      price: unitMinor / 100,
      quantity: requested.quantity,
      image: variant?.image || (Array.isArray(data.images) && typeof data.images[0] === "string" ? data.images[0] : ""),
    };
  });
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0) throw new HttpError(400, "Your order total is invalid");
  return { items, updates, subtotalMinor };
}

function checkoutInput(value: unknown): CheckoutInput {
  const input = validateOrderBody(value);
  if (!record(value) || typeof value.idempotencyKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.idempotencyKey)) {
    throw new HttpError(400, "Invalid checkout attempt");
  }
  return { ...input, idempotencyKey: value.idempotencyKey.toLowerCase() };
}

function orderDocumentId(userId: string, idempotencyKey: string) {
  return `paystack-${createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex")}`;
}

function paystackRecord(value: unknown) {
  return record(value) ? value : {};
}

export async function startPaystackCheckout(user: AppUser, body: unknown) {
  const input = checkoutInput(body);
  const database = firestore();
  const orderReference = database.collection("orders").doc(orderDocumentId(user.uid, input.idempotencyKey));
  const existing = await orderReference.get();
  if (existing.exists) {
    const data = existing.data() ?? {};
    if (data.userId !== user.uid) throw new HttpError(409, "This checkout attempt cannot be resumed");
    const payment = paystackRecord(data.paystack);
    if (data.paymentStatus === "paid" && typeof data.orderNumber === "string") {
      return { state: "paid" as const, orderNumber: data.orderNumber };
    }
    if (data.paymentStatus === "pending" && typeof payment.authorizationUrl === "string") {
      return { state: "pending" as const, authorizationUrl: payment.authorizationUrl, orderNumber: String(data.orderNumber ?? "") };
    }
    throw new HttpError(409, "This checkout attempt is no longer available. Please start again.");
  }

  const productReferences = [...new Set(input.items.map((item) => item.product))].map((id) => database.collection("products").doc(id));
  const initialProducts = await database.getAll(...productReferences);
  const initialQuote = quoteOrder(input, new Map(initialProducts.map((product) => [product.id, product])));
  const orderNumber = createOrderNumber();
  const reference = `RH-${randomUUID().replaceAll("-", "")}`;
  const payment = await initializePaystackPayment({
    email: input.customer.email,
    amount: initialQuote.subtotalMinor,
    reference,
    orderId: orderReference.id,
    orderNumber,
  });

  const result = await database.runTransaction(async (transaction) => {
    const current = await transaction.get(orderReference);
    if (current.exists) {
      const data = current.data() ?? {};
      if (data.userId !== user.uid) throw new HttpError(409, "This checkout attempt cannot be resumed");
      return { created: false, existing: data };
    }
    const products = await Promise.all(productReferences.map((product) => transaction.get(product)));
    const quote = quoteOrder(input, new Map(products.map((product) => [product.id, product])));
    if (quote.subtotalMinor !== initialQuote.subtotalMinor) {
      throw new HttpError(409, "A product price changed. Please review your cart and try again.");
    }
    for (const [id, update] of quote.updates) {
      const stockQuantity = update.variants ? update.variants.reduce((sum, item) => sum + item.stockQuantity, 0) : update.stockQuantity;
      transaction.update(database.collection("products").doc(id), {
        ...(update.variants ? { variants: update.variants } : {}),
        stockQuantity,
        inStock: stockQuantity > 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.set(orderReference, {
      userId: user.uid,
      orderNumber,
      customer: input.customer,
      items: quote.items,
      subtotal: quote.subtotalMinor / 100,
      shipping: 0,
      total: quote.subtotalMinor / 100,
      deliveryFeePending: true,
      paymentMethod: "paystack",
      paymentStatus: "pending",
      orderStatus: "pending",
      shippingMethod: "to_be_confirmed",
      inventoryReservationActive: true,
      paystack: {
        reference: payment.reference,
        authorizationUrl: payment.authorizationUrl,
        amount: quote.subtotalMinor,
        currency: "KES",
        status: "initialized",
        initializedAt: FieldValue.serverTimestamp(),
      },
      ...(input.notes ? { notes: input.notes } : {}),
      ...orderTimestamps(),
    });
    return { created: true, existing: null };
  });

  if (!result.created) {
    const paymentData = paystackRecord(result.existing?.paystack);
    if (result.existing?.paymentStatus === "paid" && typeof result.existing.orderNumber === "string") return { state: "paid" as const, orderNumber: result.existing.orderNumber };
    if (result.existing?.paymentStatus === "pending" && typeof paymentData.authorizationUrl === "string") return { state: "pending" as const, authorizationUrl: paymentData.authorizationUrl, orderNumber: String(result.existing.orderNumber ?? "") };
    throw new HttpError(409, "This checkout attempt is no longer available. Please start again.");
  }

  const syncD1 = await beginD1ReadModelUpdate("products");
  if (syncD1) {
    try {
      await Promise.all((await database.getAll(...productReferences)).map(syncD1ProductDocument));
      await markD1ReadModelReady("products");
    } catch (error) {
      console.error("Order stock was reserved safely in Firestore; D1 product projection remains disabled until resynchronized.", error);
    }
  }
  revalidateTag(PUBLIC_PRODUCTS_TAG, { expire: 0 });
  return { state: "pending" as const, authorizationUrl: payment.authorizationUrl, orderNumber };
}

function compatiblePayment(order: Record<string, unknown>, verification: Awaited<ReturnType<typeof verifyPaystackPayment>>) {
  const payment = paystackRecord(order.paystack);
  if (payment.reference !== verification.reference || payment.amount !== verification.amount || payment.currency !== "KES" || verification.currency !== "KES") return false;
  if (verification.email && typeof order.customer === "object" && order.customer && "email" in order.customer) {
    const customerEmail = (order.customer as { email?: unknown }).email;
    if (typeof customerEmail !== "string" || customerEmail.toLowerCase() !== verification.email.toLowerCase()) return false;
  }
  let metadata = verification.metadata;
  if (typeof metadata === "string") {
    try { metadata = JSON.parse(metadata) as unknown; } catch { metadata = undefined; }
  }
  if (record(metadata) && metadata.orderId !== undefined && metadata.orderId !== order.id) return false;
  return true;
}

function shouldMarkFailed(status: string) {
  return ["abandoned", "failed", "reversed"].includes(status);
}

async function releaseInventory(transaction: Transaction, order: Record<string, unknown>) {
  if (order.inventoryReservationActive !== true || !Array.isArray(order.items)) return;
  const database = firestore();
  const itemGroups = new Map<string, Array<Record<string, unknown>>>();
  for (const item of order.items) {
    if (!record(item) || typeof item.product !== "string" || typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
    itemGroups.set(item.product, [...(itemGroups.get(item.product) ?? []), item]);
  }
  const references = [...itemGroups.keys()].map((id) => database.collection("products").doc(id));
  const products = await Promise.all(references.map((reference) => transaction.get(reference)));
  for (const product of products) {
    if (!product.exists) continue;
    const data = product.data() ?? {};
    const variants = normalizeVariants(data.variants);
    let stockQuantity = Number(data.stockQuantity ?? 0);
    for (const item of itemGroups.get(product.id) ?? []) {
      if (typeof item.variantId === "string") {
        const variant = variants.find((value) => value.id === item.variantId);
        if (variant) variant.stockQuantity += item.quantity as number;
      } else {
        stockQuantity += item.quantity as number;
      }
    }
    const finalStock = variants.length ? variants.reduce((sum, variant) => sum + variant.stockQuantity, 0) : stockQuantity;
    transaction.update(product.ref, { ...(variants.length ? { variants } : {}), stockQuantity: finalStock, inStock: finalStock > 0, updatedAt: FieldValue.serverTimestamp() });
  }
}

export async function resolvePaystackPayment(reference: string, expectedUserId?: string) {
  if (!isPaystackReference(reference)) throw new HttpError(400, "Invalid payment reference");
  const database = firestore();
  const matching = await database.collection("orders").where("paystack.reference", "==", reference).limit(1).get();
  const orderReference = matching.docs[0]?.ref;
  if (!orderReference) throw new HttpError(404, "Payment order not found");
  const before = await orderReference.get();
  const beforeData = before.data() ?? {};
  if (expectedUserId && beforeData.userId !== expectedUserId) throw new HttpError(404, "Payment order not found");
  if (beforeData.paymentStatus === "paid") return { state: "paid" as const, order: serializeOrder(before), becamePaid: false };

  const verification = await verifyPaystackPayment(reference);
  if (!compatiblePayment({ id: orderReference.id, ...beforeData }, verification)) throw new HttpError(400, "Payment verification did not match this order");

  if (verification.status !== "success") {
    if (shouldMarkFailed(verification.status)) {
      await database.runTransaction(async (transaction) => {
        const current = await transaction.get(orderReference);
        const data = current.data() ?? {};
        if (data.paymentStatus !== "pending") return;
        await releaseInventory(transaction, data);
        transaction.update(orderReference, {
          paymentStatus: "failed",
          orderStatus: "cancelled",
          inventoryReservationActive: false,
          "paystack.status": verification.status,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      revalidateTag(PUBLIC_PRODUCTS_TAG, { expire: 0 });
      return { state: "failed" as const, order: serializeOrder(await orderReference.get()), becamePaid: false };
    }
    return { state: "pending" as const, order: serializeOrder(await orderReference.get()), becamePaid: false };
  }

  const becamePaid = await database.runTransaction(async (transaction) => {
    const current = await transaction.get(orderReference);
    if (!current.exists) throw new HttpError(404, "Payment order not found");
    const data = current.data() ?? {};
    if (data.paymentStatus === "paid") return false;
    if (data.paymentStatus !== "pending" || !compatiblePayment({ id: orderReference.id, ...data }, verification)) throw new HttpError(409, "This payment cannot be completed");
    transaction.update(orderReference, {
      paymentStatus: "paid",
      "paystack.status": "success",
      "paystack.transactionId": verification.transactionId ?? null,
      "paystack.paidAt": verification.paidAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  return { state: "paid" as const, order: serializeOrder(await orderReference.get()), becamePaid };
}

/** Schedule non-critical confirmation work only after a payment is durably marked paid. */
export async function notifyPaidOrder(order: PublicOrder) {
  try {
    await Promise.all([
    notifyUser(order.userId, { kind: "payment", title: "Payment received", body: `Your Paystack payment for ${order.orderNumber} was successful.`, href: "/account" }),
    notifyAdmins({ kind: "payment", title: "Paystack payment received", body: `${order.customer.name} paid KES ${order.total.toLocaleString("en-KE")} for ${order.orderNumber}.`, href: "/admin/orders?paymentStatus=paid" }),
    sendOrderConfirmation(order),
    ]);
  } catch (error) {
    console.error(`Paid-order confirmation failed (${order.id})`, error);
  }
}
