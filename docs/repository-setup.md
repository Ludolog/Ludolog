# Repository and Vercel setup

This guide prepares GameValue Radar for GitHub and Vercel without committing local secrets.

## 1. Create the GitHub repository

Preferred repository settings:

- Name: `gamevalue-radar`
- Visibility: private

If GitHub CLI is available and authenticated, run from the project root:

```bash
git branch -M main
gh repo create gamevalue-radar --private --source=. --remote=origin --push
```

If GitHub CLI is not available:

1. Go to GitHub.
2. Create a new repository named `gamevalue-radar`.
3. Set visibility to private.
4. Do not add a README, `.gitignore` or license in GitHub, because the project already has local files.
5. Copy the repository URL.
6. Run:

```bash
git remote add origin ADRES_REPO
git branch -M main
git push -u origin main
```

## 2. Files that must never be committed

Do not commit:

- `.env`, `.env.local`, `.env.production`
- `mobile/.env`, `mobile/.env.local`, `mobile/.env.production`
- Neon, Vercel, Firebase, Steam or price API tokens
- Android `local.properties`
- keystores: `*.jks`, `*.keystore`, `keystore.properties`
- APK/AAB artifacts: `*.apk`, `*.aab`
- dependency folders such as `node_modules`
- generated build outputs: `.next`, `out`, `dist`, `mobile/dist`, Android `build` folders
- logs and temporary files

The example files are safe to commit when they contain placeholders only:

- `.env.example`
- `.env.local.example`
- `mobile/.env.example`
- `mobile/.env.production.example`

## 3. First commit

Before committing, verify that local env files are ignored:

```bash
git status --short
git status --short --ignored
```

If `.env.local` appears as an untracked file, stop and fix `.gitignore` before continuing.

Then create the first commit:

```bash
git add .
git status --short
git commit -m "Initial GameValue Radar MVP with Android client and cloud deployment readiness"
```

## 4. Connect the repository to Vercel

1. Open Vercel.
2. Choose `Add New -> Project`.
3. Import the GitHub repository `gamevalue-radar`.
4. Keep framework preset as `Next.js`.
5. Add the required environment variables before deploying.

## 5. Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

```env
DATABASE_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
REPOSITORY_PROVIDER=prisma
DATA_MODE=mock
NEXT_PUBLIC_APP_URL=https://ADRES-Z-VERCEL
MOBILE_ALLOWED_ORIGINS=https://ADRES-Z-VERCEL,capacitor://localhost
```

Use the pooled Neon host for `DATABASE_URL` and the direct Neon host for `DIRECT_URL`.

## 6. Local environment variables

Create `.env.local` in the project root:

```env
DATABASE_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
REPOSITORY_PROVIDER=prisma
DATA_MODE=mock
NEXT_PUBLIC_APP_URL=http://localhost:3000
MOBILE_ALLOWED_ORIGINS=http://localhost:3000,capacitor://localhost
```

Replace only `TWOJE_HASLO` locally or in Vercel settings. Do not commit the filled connection strings.

For Android emulator local development, create `mobile/.env.local`:

```env
VITE_API_BASE_URL=http://10.0.2.2:3000
```

Do not switch Android production URLs to Vercel until the Vercel deployment is live.

## 7. Fresh clone check

After cloning the repository on a new machine:

```bash
npm install
npm install --prefix mobile
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run mobile:build
npm run mobile:sync
```

Then fill `.env.local` with the local Neon credentials and run:

```bash
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

## 8. Check that `.env.local` is not tracked

Run:

```bash
git ls-files .env.local
git status --short --ignored .env.local
```

The first command should print nothing. The second command should show `.env.local` as ignored.
