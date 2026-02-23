# Ascended Social

## Overview
Ascended Social is a spiritual social media platform where users connect through chakra-based content, energy systems, oracle readings, and a clean dark-mode UI. Built as a full-stack monorepo on Replit.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js v5 + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect via passport)
- **Storage**: Replit Object Storage (Google Cloud Storage)
- **Routing**: wouter (client-side)
- **State**: TanStack Query v5

## Project Structure
```
client/src/
  pages/
    landing.tsx      - Login page (minimal, clean design)
    feed.tsx         - Main feed with chakra-filtered posts
    post-detail.tsx  - Post detail with comments
    profile.tsx      - User profile with chakra distribution
    oracle.tsx       - Oracle readings (daily + tarot)
    onboarding.tsx   - Profile setup (4-step flow)
    not-found.tsx    - 404 page
  hooks/
    use-auth.ts      - Auth hook (Replit Auth)
    use-toast.ts     - Toast notifications
    use-upload.ts    - File upload hook (Object Storage)
  lib/
    queryClient.ts   - TanStack Query config
    auth-utils.ts    - Auth error handling
  components/
    ui/              - shadcn/ui components
    ObjectUploader.tsx - File upload component (Uppy)

server/
  index.ts           - Express server entry
  routes.ts          - All API routes
  storage.ts         - DatabaseStorage (Drizzle CRUD)
  db.ts              - Database connection (pg Pool)
  replit_integrations/
    auth/            - Replit Auth module
    object_storage/  - Object Storage module

shared/
  schema.ts          - Drizzle schema + Zod validation + types
  models/auth.ts     - Auth tables (users, sessions)
```

## Database Schema
- **users** - Profiles with spiritual attributes (aura level, energy points, dominant chakra, spirit info)
- **posts** - Content with chakra categorization and frequency scores
- **comments** - Post comments
- **sparks** - Spiritual engagement/reactions (toggle on/off)
- **oracles** - Generated spiritual readings (daily + tarot)
- **energy_transactions** - Energy point tracking (earn/spend)
- **reports** - Content reports
- **sessions** - Express session storage (Replit Auth)

## Key Features
1. **Chakra System** - 7 chakras (root, sacral, solar_plexus, heart, throat, third_eye, crown) with color coding
2. **Energy System** - Users earn energy through posting (5pts), commenting (2pts), sparking (1pt), daily reading (10pts); spend on tarot (15pts)
3. **Oracle Readings** - Daily readings (free, once/day) and tarot 3-card spread
4. **Sparks** - Toggle-based reactions on posts
5. **Onboarding** - 4-step spiritual profile setup (name, path, chakra, bio)

## API Routes
- `GET /api/posts` - Feed (optional `?chakra=` filter)
- `POST /api/posts` - Create post (auto-assigns chakra + frequency)
- `GET/POST /api/posts/:id/comments` - Comments
- `POST /api/posts/:id/spark` - Toggle spark
- `GET /api/posts/:id/spark` - Check user's spark status
- `GET /api/users/:id` - User profile
- `PATCH /api/users/me` - Update own profile
- `GET /api/oracles` - User's readings
- `POST /api/oracles/daily` - Get daily reading
- `POST /api/oracles/tarot` - Get tarot reading (costs 15 energy)
- `GET /api/energy` - Energy balance + transactions
- `POST /api/uploads/request-url` - Get presigned upload URL
- Auth: `/api/login`, `/api/logout`, `/api/auth/user`

## Running
- `npm run dev` starts Express + Vite on port 5000
- `npm run db:push` pushes schema to PostgreSQL

## Theme & Design
- Dark mode by default (class="dark" on html element)
- Purple (270 hue) primary color palette
- Minimal, typography-driven design
- Chakra-specific accent colors as small color dots
- Content-first layout with subtle borders and spacing

## User Preferences
- Dark mode preferred
- Human-designed aesthetic (not template/AI-looking)
- Simple login page, not marketing landing page
