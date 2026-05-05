<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/hubfy-lite/hubfy-lite/main/public/brand/logo-hubfy-light.png">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/hubfy-lite/hubfy-lite/main/public/brand/logo-hubfy-dark.png">
    <img src="https://raw.githubusercontent.com/hubfy-lite/hubfy-lite/main/public/brand/logo-hubfy-dark.png" alt="Hubfy" width="180">
  </picture>

  <br/>
  <br/>

  **Self-hosted member area and digital product platform — open-source, no monthly fees.**

  <br/>

  [![License: BSL 1.1](https://img.shields.io/badge/license-BSL_1.1-black)](./LICENSE)
  [![Setup Wizard](https://img.shields.io/badge/Setup_Wizard-lp.hubfy.io%2Fsetup-black)](https://lp.hubfy.io/setup)
  [![Hubfy](https://img.shields.io/badge/Cloud-hubfy.io-black)](https://hubfy.io)

</div>

---

Hubfy Lite is the open-source, self-hosted edition of [Hubfy](https://hubfy.io). Deploy your own platform for selling and delivering digital products, online courses, and membership content — on your own infrastructure, with your own Supabase project.

> ⚠️ **Preview release.** This is a test/preview version released under a restricted Business Source License (BSL 1.1). Commercial use and SaaS offering are **not** permitted. See [`LICENSE`](./LICENSE) for full terms.

---

## Features

- 🎓 **Online courses** — structured modules and lessons with progress tracking
- 📦 **Digital products** — sell files, resources, and membership access
- 👥 **Member portal** — branded customer-facing area for accessing purchased content
- 🎨 **Design customization** — colors, logo, and portal appearance
- 💳 **Payment gateway** — Hotmart integration built-in (webhook-based order sync)
- 🎬 **Video hosting** — [Gumlet](https://www.gumlet.com/) as the default video provider (upload, transcode, protected playback)
- 🔗 **Additional video integrations** — Vimeo, Panda Video, Wistia, Smart Player, YouTube
- 🤖 **AI content generation** — Anthropic and OpenAI integrations for lesson content
- 📊 **Dashboard & orders** — revenue KPIs, recent sales, order management
- 🌍 **Internationalization** — Portuguese (BR), English, and Spanish
- 👨‍💼 **Team management** — invite collaborators with role-based access
- 🔒 **Row-level security** — full multi-tenant isolation via Supabase RLS
- 🛡️ **Superadmin panel** — cross-workspace visibility for the platform owner

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Edge Functions | Deno (TypeScript) |
| Video hosting | Gumlet (default) |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Rich text | BlockNote |
| i18n | i18next |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) 1.x (manual setup only)
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Resend](https://resend.com/) account for transactional emails (invites and portal access)
- A [Gumlet](https://www.gumlet.com/) account (optional — required only if you want to use Hubfy Lite's built-in video hosting; other providers like Vimeo, Panda Video, and Wistia can be connected as integrations instead)
- A [Hotmart](https://hotmart.com/) account (optional — only required for payment gateway integration)

---

## Getting Started

There are two ways to set up Hubfy Lite: the **Setup Wizard** (recommended — no terminal required) or the **manual setup** for those who prefer full control via CLI.

---

### Option A — Setup Wizard (Recommended)

The Setup Wizard at **[lp.hubfy.io/setup](https://lp.hubfy.io/setup)** handles the database setup for you and generates a ready-to-run install command.

#### Step 1 — Open the Wizard

Go to **https://lp.hubfy.io/setup** and fill in your contact details. This registers you in the Hubfy community and gives you access to updates and support.

#### Step 2 — Connect your Supabase project

The Wizard will ask for your **Supabase Personal Access Token (PAT)**.

> Get yours at: [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → click **Generate new token**.

After entering the token, the Wizard lists all projects in your Supabase account. You can select an existing project or create a new one directly from the Wizard.

#### Step 3 — Run migrations

The Wizard automatically runs all database migrations against your chosen project. This sets up all tables, RLS policies, and functions required by Hubfy Lite.

#### Step 4 — Run the generated install command

At the end of the Wizard, you receive a single command to run in your terminal. It looks like this:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/hubfy-lite/hubfy-lite/main/scripts/install.sh) <TOKEN>
```

This command:
- Clones the repository into a `hubfy/` folder
- Creates a pre-configured `.env.local` with your Supabase credentials
- Runs `npm install`
- Deploys all edge functions to your Supabase project

#### Step 5 — Set edge function secrets

After the install script finishes, set the required secrets in your Supabase project:

```bash
cd hubfy
npx supabase secrets set \
  PUBLIC_SITE_URL=https://yourplatform.com \
  EMAIL_FROM_ADDRESS=noreply@yourplatform.com \
  RESEND_API_KEY=re_...
```

> See the [Edge Function Secrets](#edge-function-secrets) section for the full list of secrets.

#### Step 6 — Start the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:8784**.

---

### Option B — Manual Setup (CLI)

Use this path if you prefer to set everything up yourself without going through the Wizard.

#### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) 1.x
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Resend](https://resend.com/) account for transactional emails

#### 1. Clone the repository

```bash
git clone https://github.com/hubfy-lite/hubfy-lite.git
cd hubfy-lite
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Create the environment file

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your Supabase project URL and anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your_anon_key
VITE_PUBLIC_SITE_URL=http://localhost:8784
SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

> Find these values in your Supabase project: **Project Settings → API**.

#### 4. Log in to Supabase CLI and link the project

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

#### 5. Run database migrations

```bash
npx supabase db push
```

This applies all migrations from `supabase/migrations/` to your database — tables, RLS policies, and database functions.

#### 6. Deploy edge functions

```bash
npx supabase functions deploy
```

This deploys all Deno edge functions in `supabase/functions/` to your Supabase project.

#### 7. Set edge function secrets

```bash
npx supabase secrets set \
  PUBLIC_SITE_URL=https://yourplatform.com \
  EMAIL_FROM_ADDRESS=noreply@yourplatform.com \
  RESEND_API_KEY=re_...
```

> See the [Edge Function Secrets](#edge-function-secrets) section for the full list.

#### 8. Start the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:8784**.

---

## First Steps After Installation

Once the platform is running, here is the recommended flow to get your first workspace ready:

### 1. Create a workspace

Sign up at `/signup`. During onboarding you will be prompted to name your workspace and configure your public URL slug. Complete the profile setup before accessing the admin panel.

### 2. Connect Hotmart (payment gateway)

Go to **Admin → Integrations → Hotmart** and enter your Hotmart credentials. After connecting, configure the **webhook URL** in your Hotmart dashboard so that new purchases are automatically synced as orders:

```
https://<your-supabase-project-ref>.supabase.co/functions/v1/gateway-webhook
```

Map your Hotmart products to Hubfy Lite products inside the **Integrations → Mapping** tab.

### 3. Create a product

Go to **Admin → Products → New Product**. A product is what the customer buys — it controls access and is linked to one or more courses.

### 4. Create a course and link it to the product

Go to **Admin → Courses → New Course**. Build the course structure (modules and lessons), then open the product settings and link the course to it. Students who purchase the product gain access to the linked course automatically.

### 5. Upload video lessons

If you configured `GUMLET_API_KEY` in your edge function secrets, Hubfy Lite's built-in video hosting is already available — no extra setup needed. Open a lesson and upload your video directly; the platform sends it to Gumlet, which transcodes and hosts it. Students stream it through the protected embedded player.

If you prefer a different provider (Vimeo, Panda Video, Wistia, or Smart Player), connect it first under **Admin → Integrations**, then select it when uploading a lesson video.

### 6. Publish

Set the course and product to **published** status. Share your portal URL (`https://yourplatform.com/<your-slug>`) with students.

---

## Video Hosting

Hubfy Lite offers two ways to host lesson videos:

### Built-in hosting (Gumlet)

[Gumlet](https://www.gumlet.com/) is the **default, built-in video provider**. When the platform owner configures a `GUMLET_API_KEY` edge function secret, Hubfy Lite acts as a white-label video management layer on top of Gumlet — workspaces can upload videos, configure player settings, and enable video protection (signed URLs), all from inside the admin panel without any manual Gumlet setup per workspace.

Think of it as native video hosting built into your Hubfy Lite instance.

**Required secret:** `GUMLET_API_KEY` — obtain it from your [Gumlet dashboard](https://dashboard.gumlet.com/) under **Settings → API Keys**.

### External integrations

Workspace owners can also connect third-party video providers under **Admin → Integrations**:

| Provider | Type |
|----------|------|
| [Vimeo](https://vimeo.com/) | Import from library |
| [Panda Video](https://pandavideo.com/) | Upload and stream |
| [Wistia](https://wistia.com/) | Upload and stream |
| [Smart Player](https://smartplayer.com.br/) | External player embed |
| YouTube | Embed by URL (no upload) |

Each integration is configured per workspace and requires its own credentials. Once connected, the provider can be selected when uploading or linking a video in the lesson editor.

---

## Superadmin Panel

Hubfy Lite includes a built-in **Superadmin** panel at `/superadmin/dashboard`. This is intended for the **owner of the self-hosted installation** who wants a global view across all workspaces on their instance — useful if you manage multiple brands or clients on a single deployment.

The Superadmin panel gives access to:
- Cross-workspace metrics (tenants, customers, revenue, orders)
- Full list of workspaces (tenants) with filters
- Global customers, orders, products, and users views
- Seller/gateway event logs

### Granting Superadmin access

Superadmin access is **not granted automatically** — it must be assigned manually via the Supabase dashboard. This is intentional to prevent accidental privilege escalation.

1. Open your Supabase project → **Table Editor** (or **SQL Editor**)
2. Find the `auth.users` table and copy the UUID of the user you want to promote
3. Run the following SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<user-uuid-here>', 'admin')
ON CONFLICT DO NOTHING;
```

4. The user can now access `/superadmin/dashboard`

> The `'admin'` role in `user_roles` is the superadmin role. Regular workspace owners hold the `'tenant'` role and only see their own data.

---

## Environment Variables

Create a `.env.local` file at the project root (copy from `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Your Supabase anon/public key |
| `VITE_PUBLIC_SITE_URL` | ✅ | The public URL of your deployment (e.g. `https://yourplatform.com`) |
| `SUPABASE_PROJECT_ID` | Dev only | Project ref — used by `npm run gen:types` to regenerate TypeScript types |

### Edge Function Secrets

Set these in the Supabase dashboard (**Project Settings → Edge Functions → Secrets**) or via the CLI:

```bash
npx supabase secrets set KEY=value
```

| Secret | Required | Description |
|--------|----------|-------------|
| `PUBLIC_SITE_URL` | ✅ | Public URL of the deployment — used in email links (mirror of `VITE_PUBLIC_SITE_URL`) |
| `EMAIL_FROM_ADDRESS` | ✅ | Sender address for transactional emails (e.g. `noreply@yourplatform.com`) |
| `RESEND_API_KEY` | ✅ | [Resend](https://resend.com) API key for email delivery |

**Built-in video hosting (Gumlet)** — enables native video hosting for all workspaces on your instance:

| Secret | Description |
|--------|-------------|
| `GUMLET_API_KEY` | [Gumlet](https://www.gumlet.com/) API key — enables built-in upload, transcoding, and protected playback |

**External video integrations** — required only for the provider(s) connected under **Admin → Integrations**:

| Secret | Provider |
|--------|----------|
| `VIMEO_CLIENT_ID` / `VIMEO_CLIENT_SECRET` / `VIMEO_ACCESS_TOKEN` | Vimeo |
| `PANDAVIDEO_API_KEY` | Panda Video |
| `WISTIA_API_KEY` | Wistia |

**Payment gateway secrets** — required only if using Hotmart integration:

| Secret | Description |
|--------|-------------|
| `HOTMART_CLIENT_ID` | Hotmart OAuth client ID |
| `HOTMART_CLIENT_SECRET` | Hotmart OAuth client secret |
| `HOTMART_WEBHOOK_TOKEN` | Token for validating incoming Hotmart webhooks |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at `http://localhost:8784` |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run gen:types` | Regenerate Supabase TypeScript types |

---

## Project Structure

```
hubfy-lite/
├── src/
│   ├── components/        # Shared UI components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── features/          # Feature-scoped logic
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Translations (pt-BR, en, es)
│   ├── integrations/      # Supabase client & generated types
│   ├── lib/               # Utilities and helpers
│   └── pages/             # Route-level page components
│       ├── admin/         # Admin panel pages
│       ├── portal/        # Customer-facing portal
│       ├── course/        # Course player
│       └── superadmin/    # Superadmin panel (cross-workspace)
├── supabase/
│   ├── functions/         # Deno edge functions
│   ├── migrations/        # Database migrations
│   └── config.toml        # Supabase CLI config
└── public/                # Static assets
```

---

## Deployment

Hubfy Lite can be deployed to any static hosting provider for the frontend and uses Supabase as the backend.

**Frontend:** Netlify, Vercel, Cloudflare Pages, or any static host.

**Backend:** Your Supabase project handles database, auth, storage, and edge functions automatically.

### Example: Deploy to Netlify

```bash
npm run build
# Upload the dist/ folder to Netlify, or connect via Git integration
```

Set the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL`) in your hosting provider's dashboard.

> **Important:** Edge function secrets (`RESEND_API_KEY`, `GUMLET_API_KEY`, etc.) are set in the **Supabase** dashboard, not in the frontend hosting provider.

---

## License

Hubfy Lite is released under the **Business Source License 1.1**.

- ✅ Free for internal and personal use
- ✅ Modify and self-host for your own projects
- ❌ Cannot be offered as a SaaS or managed service to third parties
- ❌ Cannot be resold or commercialized
- ❌ Cannot be used to build a competing digital product/membership platform

On **2032-01-01**, the license converts to **Apache License 2.0**.

See [`LICENSE`](./LICENSE) for the full terms.

---

## Trademark

"Hubfy" is a registered trademark of Hubfy. This project does not grant permission to use the Hubfy name, logo, or branding to represent or market any product or service without prior written permission.

---

## Contributing

Community contributions are welcome. Please open an issue before submitting large pull requests so we can discuss the approach.

---

## Support

For questions and community discussion, open an [issue](https://github.com/hubfy-lite/hubfy-lite/issues) on GitHub.
