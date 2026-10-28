export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href?: string;
  kind: "account" | "order" | "payment" | "contact" | "donation" | "interest" | "system";
  readAt?: string | null;
  createdAt?: string;
}

export interface ProductSpecifications {
  [key: string]: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  image?: string;
}

export interface WholesaleTier {
  minQuantity: number;
  price: number;
}

export interface Product {
  id?: string;
  name: string;
  slug: string;
  description: string;
  features?: string;
  variants?: ProductVariant[];
  saleType?: "retail" | "wholesale";
  wholesaleTiers?: WholesaleTier[];
  category: string;
  price: number;
  originalPrice?: number;
  images: string[];
  inStock: boolean;
  stockQuantity: number;
  specifications?: ProductSpecifications;
  brand?: string;
  model?: string;
  featured: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  status: "active" | "inactive" | "draft";
  organicCertified?: boolean;
  harvestDate?: unknown;
  seedType?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  count: number;
  image?: string;
}

export type PublicProduct = Product & {
  id: string;
  _id: string;
};

export type CartItem = PublicProduct & {
  quantity: number;
  variantId?: string;
  variantName?: string;
};

export interface ArticleAuthor {
  uid: string;
  name: string;
  email?: string;
  bio?: string;
  managed?: boolean;
}

export interface AuthorProfile {
  id: string;
  name: string;
  bio: string;
}

export interface StudyCategoryOption {
  id?: string;
  name: string;
  slug: string;
  count: number;
}

export interface ResourceMajorCategory {
  id: string;
  kind: "major";
  name: string;
  slug: string;
  order: number;
  count: number;
}

export interface ResourceSubcategory {
  id: string;
  kind: "subcategory";
  parentId: string;
  name: string;
  slug: string;
  order: number;
  count: number;
}

export interface ResourceTaxonomy {
  majors: ResourceMajorCategory[];
  subcategories: ResourceSubcategory[];
}

export interface ChatCategory {
  id: string;
  label: string;
  phone: string;
}

export interface ChatSettings {
  directPhone: string;
  categories: ChatCategory[];
}

export interface Article {
  id?: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage?: string;
  /** @deprecated Compatibility field for records created before resource taxonomy v2. */
  category: string;
  /** @deprecated Compatibility field for records created before resource taxonomy v2. */
  studyCategory?: string;
  majorCategoryId: string;
  subcategoryId?: string;
  tags: string[];
  author: ArticleAuthor;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  published: boolean;
  publishedAt?: unknown;
  views: number;
  isDownloadable: boolean;
  fileKey?: string;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublicArticle = Article & {
  id: string;
  _id: string;
};

export interface OrderItem {
  product: string;
  variantId?: string;
  variantName?: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  address?: {
    street?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface Order {
  id?: string;
  _id?: string;
  userId: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  deliveryFeePending?: boolean;
  paymentMethod: "paystack" | "mpesa" | "bank_transfer" | "cash_on_delivery" | "card" | "pending";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus: string;
  notes?: string;
  shippingMethod: "standard" | "express" | "pickup" | "to_be_confirmed";
  inventoryReservationActive?: boolean;
  paystack?: {
    reference: string;
    authorizationUrl?: string;
    amount: number;
    currency: "KES";
    status: string;
    transactionId?: string | null;
    initializedAt?: unknown;
    paidAt?: unknown;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublicOrder = Order & {
  id: string;
  _id: string;
};

export interface ContactMessage {
  id?: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  createdAt?: unknown;
}

export interface Donation {
  id?: string;
  _id?: string;
  userId?: string;
  name?: string;
  email?: string;
  /** Official settled and reported amount. Donations are always charged in KES. */
  amountKes: number;
  currency: "KES";
  purpose?: string;
  /** Original selection is retained for audit only when a USD quote was used. */
  originalCurrency?: "USD";
  originalAmount?: number;
  conversionRate?: number;
  status: "pending" | "succeeded" | "failed" | "refunded";
  paymentMethod: "paystack";
  reference?: string;
  source?: "firestore" | "paystack";
  paystack?: {
    reference: string;
    authorizationUrl?: string;
    amount: number;
    currency: "KES";
    status: string;
    transactionId?: string | null;
    initializedAt?: unknown;
    paidAt?: unknown;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublicDonation = Donation & {
  id: string;
  _id: string;
};
