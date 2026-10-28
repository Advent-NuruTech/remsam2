# Required environment variables

Add these secrets in `.env.local` for local development and in Vercel's
project settings for deployment. Never prefix a secret with `NEXT_PUBLIC_`.

| Service | Variables | Used for |
| --- | --- | --- |
| Firebase client | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser Firebase Auth |
| Firebase Admin | `FIREBASE_SERVICE_ACCOUNT_KEY`, or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Token verification and Firestore on the server |
| Admin signup | `SIGN_UP_CODE` | Server-only access code required by `/admin/signup` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME` (or existing `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`), `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Legacy product/resource images and cleanup |
| Cloudflare R2 | `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `R2_PUBLIC_URL` | Product/resource images and PDFs, DOC/DOCX and PPT/PPTX downloads |
| Cloudflare D1 | `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `D1_DATABASE_ID` | Article bodies and public article/product read models |
| YouTube | `YOUTUBE_API_KEY` | Server-side YouTube Data API key for the channel feeds |
| Paystack | `PAYSTACK_SECRET_KEY`, optional `PAYSTACK_CALLBACK_URL` | Secure server-side checkout, verification and webhook signatures |

## Paystack checkout

Set `PAYSTACK_SECRET_KEY` only in the server environment. Never use the
`NEXT_PUBLIC_` prefix and never place this key in browser code. In the Paystack
dashboard, set the webhook URL to:

`https://your-domain/api/payments/paystack/webhook`

The app verifies the HMAC-SHA512 webhook signature and independently verifies
the transaction with Paystack before marking an order paid. The callback defaults
to `NEXT_PUBLIC_SITE_URL/payment/verify`; set `PAYSTACK_CALLBACK_URL` only when
you need a different HTTPS callback URL.

Study-material uploads are accepted at `POST /api/study-materials` as a
multipart `file` (or `document`) field. Store the returned `fileKey`,
`fileName`, and `fileType` on the article payload. Downloads use the returned
same-origin `fileUrl`; the R2 bucket does not need to be public.

## D1 public read model

Public article listings, article details, product listings and product details
read from indexed D1 tables. Firestore remains authoritative for administrator
records, category management, inventory and checkout transactions. If D1 is
unavailable or a synchronization is incomplete, the application automatically
uses the cached Firestore read path instead of serving stale D1 data.

After applying a deployment that changes `db/schema.sql`, initialize and
backfill the read model before directing production traffic to it:

```powershell
npm run migrate:d1
npm run sync:d1-public
```

Both commands use the server-only credentials above. The synchronization
replaces only `public_articles` and `public_products`; it does not modify
article bodies, orders, users, media or R2 documents. Normal administrator
article/product writes keep the D1 projection synchronized. An administrator
can also repair it with `POST /api/admin/d1-sync` (optionally with
`?area=articles` or `?area=products`).

`CF_API_TOKEN` needs D1 permissions. R2 credentials must be scoped to the
documents bucket. Use the matching Vercel Development, Preview and Production
environment settings.

For split Firebase Admin credentials, keep the private key quoted and retain
its escaped newlines:

```dotenv
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

The application converts the escaped `\n` sequences before initializing the
Admin SDK. None of these three variables may use the `NEXT_PUBLIC_` prefix.

## Creating an administrator account

Open `/admin/signup`, enter the administrator's name, email, password, and the
value configured in `SIGN_UP_CODE`. The code is submitted to the server for a
timing-safe comparison and is never exposed through a `NEXT_PUBLIC_` variable.
After successful validation, the server creates `users/{uid}` with
`role: "admin"` and the browser opens `/admin/dashboard`.

Use a long, random value for `SIGN_UP_CODE`, configure the same value in the
deployment environment, and rotate it after onboarding administrators. Normal
application registration still always creates `role: "user"` accounts.

If the signup screen cannot be used, an owner can still bootstrap an
administrator manually:

1. Create the account through the application (or Firebase Authentication's
   **Users** screen) and copy its Firebase **UID**.
2. In the Firebase console for the same project, open **Firestore Database** →
   `users` → the document whose ID is that exact UID. If it does not exist,
   create it with the exact UID as its document ID.
3. Preserve or enter `name` and `email`, set `role` to the string `admin`, and
   ensure `createdAt` and `updatedAt` are Firestore Timestamp values (use the
   console's current-time option for each timestamp when creating a document).
4. Save, then sign out and sign back in (or refresh the page) so the client
   reloads `/api/auth/me` and sees the new role.

Do this only from the Firebase console while signed into the project owner
account. Never expose `SIGN_UP_CODE`, add a client-side role selector, or commit
a service-account script for role promotion.

## YouTube channels

Enable YouTube Data API v3 for the project and set `YOUTUBE_API_KEY` in the
server environment. In `/admin/youtube`, paste up to two channel URLs and save.
The homepage shows the latest uploads and `/videos` lets visitors page through
them. Channel settings occupy one Firestore document and are cached for one
hour; video pages are fetched from YouTube and cached for one hour, so the
number of Firestore reads does not grow with the number of videos. Shared HTTP
caches can keep an older response for up to five minutes after a settings change.

Existing `NEXT_PUBLIC_YOUTUBE_CHANNEL_ID` and `NEXT_PUBLIC_YOUTUBE_CHANNEL_ID_2`
remain fallback settings until an administrator saves channel settings. Legacy
`NEXT_PUBLIC_YOUTUBE_API_KEY` and `NEXT_PUBLIC_YOUTUBE_API_KEY_2` are accepted
as fallbacks, but migrate to the server-only key and remove the public variables
from the deployment. API key restrictions must permit server-side YouTube Data
API requests. YouTube quota and cache behavior depend on traffic and hosting.
