# Git and Vercel deployment

## 1. Verify locally

Use Node.js 22 or later; Firebase Admin and the Firestore client require it.
Keep real credentials only in `.env.local` and run:

```powershell
npm ci
npm run phase8:check
npm run verify
```

When service changes need live verification, also run the relevant commands:

```powershell
npm run migrate:d1
npm run sync:d1-public
npm run smoke:firebase
npm run smoke:cloudinary
npm run smoke:r2
```

The service smoke tests may create and immediately remove temporary records or
objects. The production HTTP smoke suite is read-only.

## 2. Commit and push

Before committing, confirm `.env.local`, `.next`, `node_modules`, and any
service-account JSON file are absent from `git status`:

```powershell
git add -A
git status
git diff --cached --check
git commit -m "Migrate application to root Next.js stack"
git push origin HEAD
```

If `.env.local` appears in the staged changes, stop and remove it from the
index with `git restore --staged .env.local` before committing.

## 3. Configure Vercel

1. Import the Git repository into Vercel.
2. Select **Next.js** as the framework preset.
3. Leave **Root Directory** empty because `package.json` is at repository root.
4. Keep the install command as `npm install` and build command as
   `npm run build`.
5. Copy the variables named in `.env.example` into the appropriate Vercel
   Development, Preview, and Production environments. Do not upload
   `.env.local` itself.
6. Deploy a Preview and complete the application acceptance checks before
   promoting it to Production.

## 4. Acceptance and production smoke test

- Verify administrator and normal-user authorization.
- Create, update, and delete a disposable product and article, including media.
- Complete checkout with a test product and verify stock and order ownership.
- Submit the contact and donation forms and verify their Firestore records.
- Check public and admin routes at desktop and mobile widths.
- Confirm the custom domain, HTTPS, redirects, and canonical routes.

Then run the read-only HTTP smoke suite:

```powershell
npm run phase8:smoke -- https://your-production-domain.example
```

Monitor Vercel, Firebase, Cloudinary, and Cloudflare logs during acceptance.

For the D1 public read model, run `npm run migrate:d1` first and then
`npm run sync:d1-public`. Confirm that both areas report synchronized counts
before promotion. Public requests fall back to cached Firestore data if the D1
schema is missing, unavailable, or marked incomplete, so schema deployment and
application deployment can be rolled out without an outage.

## Document upload cleanup

Configure an R2 lifecycle rule to expire objects under `study-upload-parts/` after one day. Uploads normally remove their temporary parts automatically; the rule also cleans up parts if a browser closes or loses connectivity before cleanup can run. Documents remain limited to 20 MB.

## Admin updates

Run `npm run migrate:d1` when deploying the Updates page. The migration creates the D1 table and adds the initial author-management announcement once. Subsequent migrations preserve edits and deletions. Administrators can maintain entries in **Updates**.

For a completed feature, an authorized maintainer can also publish directly to D1 using a stable, unique ID and plain language:

```powershell
node --env-file=.env.local scripts/publish-admin-update.mjs "feature-id" "Short title" "What changed and how to use it."
```

Run this against the intended environment only after the feature is released and verified for users. The script does not overwrite an existing ID.

## Customer accounts and Google sign-in

1. Add `auth.remsamhomestead.com` to the same Vercel project as the storefront. Follow Vercel's domain instructions to configure DNS and HTTPS. Do not redirect this hostname to the storefront: Firebase's `/__/auth/` helpers must be served on it. The Next.js rewrite transparently proxies these paths to the project's Firebase Hosting helper.
2. Set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=auth.remsamhomestead.com` and confirm `NEXT_PUBLIC_FIREBASE_PROJECT_ID` matches the Firebase project. Redeploy because public variables are compiled into the browser bundle.
3. In Firebase Authentication, enable Email/Password and Google under Sign-in method. Under Settings > Authorized domains, add `auth.remsamhomestead.com`, `remsamhomestead.com`, and `www.remsamhomestead.com` (and only the preview or localhost domains you need for testing).
4. In Google Cloud > Google Auth Platform > Clients, edit the web OAuth client used by Firebase Google sign-in. Add `https://auth.remsamhomestead.com/__/auth/handler` to Authorized redirect URIs. Keep existing Firebase redirect URIs in place. Add `https://auth.remsamhomestead.com`, `https://remsamhomestead.com`, and `https://www.remsamhomestead.com` to Authorized JavaScript origins. If using a different client, enter that client's ID and secret in Firebase's Google provider settings.
5. In Google Auth Platform > Branding, use RemSam as the app name, verify ownership of `remsamhomestead.com`, provide the homepage and privacy policy, and submit branding for verification if required. Set the audience to External and publish for public access when ready. The exact text shown by Google is controlled by Google and verification status.
6. After deploying, test email signup, password reset, Google signup and sign-in, checkout and order ownership, changing a name and password, and verifying an email change. Test on mobile and desktop. Check `https://auth.remsamhomestead.com/__/auth/handler` reaches the Firebase handler without a redirect to another host.

The account page is `/account` on the storefront and is also available on the auth hostname when it points to the same deployment. Firebase browser sessions are origin-scoped: signing in on one hostname does not sign the browser in on another. Storefront links and checkout use the storefront session, while `auth.remsamhomestead.com` supplies the branded Google OAuth handler.
