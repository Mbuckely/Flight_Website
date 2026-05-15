# RideTEGO Frontend

This is the Next.js app for the RideTEGO flight website.

## Run It

```powershell
npm run dev
```

Open `http://localhost:3000`.

## Folder Map

| Folder | Purpose |
| --- | --- |
| `app` | Next.js routes, pages, layouts, and frontend API proxy routes. See `app/README.md`. |
| `components` | Reusable UI components grouped by feature. See `components/README.md`. |
| `lib` | API helpers, auth helpers, data mappers, and shared types. See `lib/README.md`. |
| `public` | Static image assets served by Next.js. |

## Important Commands

```powershell
npm run dev
npm run build
npm run lint
npx tsc --noEmit
```

## Environment

Create `Frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
```

## API Flow

Browser pages call `app/api/*` proxy routes, those proxy routes call the Express backend in `../Backend`, and the backend handles SearchAPI/Supabase work.
