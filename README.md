# bike-trip-planner

A web app for cyclists to plan bikepacking trips: define a route (GPX import, click start/finish, or a distance-based generated loop), set group size and dates, then manage a shared packing list (with smart suggestions) and stop points collaboratively with your group.

See [`.claude/plans/`](.claude/plans) or the project's saved plan for the full architecture and milestone breakdown.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- Supabase (Postgres + PostGIS, Auth, Realtime, Storage)
- Prisma ORM
- MapLibre GL JS for maps, OpenRouteService for routing (later milestones)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Copy `.env.example` to `.env.local` and `.env` (Prisma CLI reads `.env`, the app reads `.env.local`) and fill in your Supabase project's URL, anon key, service role key, and Postgres connection strings (Project Settings → API and → Database → Connect).

### Database

```bash
npx prisma migrate dev
```

## Current status

M0 (auth + trip CRUD) is complete. See task list / plan for upcoming milestones: route input (GPX import, point-to-point, distance-based generation), packing lists with smart suggestions, stop points, and group collaboration.
