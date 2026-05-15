# Frontend Pages

This folder uses the Next.js App Router. Every route is a folder with a `page.tsx` file.

## Main Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `app/page.tsx` | Home page built from reusable home sections. |
| `/book-flight` | `app/book-flight/page.tsx` | Main flight and hotel booking/search flow. |
| `/dashboard` | `app/dashboard/page.tsx` | Role-aware dashboard for trips, approvals, and stats. |
| `/approvals` | `app/approvals/page.tsx` | Manager/admin approval review queue. |
| `/trips` | `app/trips/page.tsx` | User trip history and approved travel details. |
| `/admin/users` | `app/admin/users/page.tsx` | Admin/manager user and role management. |
| `/settings` | `app/settings/page.tsx` | Profile/settings screen. |
| `/login` | `app/login/page.tsx` | Login form. |
| `/signup` | `app/signup/page.tsx` | Signup form. |
| `/forgot-password` | `app/forgot-password/page.tsx` | Request a password reset. |
| `/reset-password` | `app/reset-password/page.tsx` | Finish password reset. |
| `/about` | `app/about/page.tsx` | Static marketing/about page. |
| `/mission` | `app/mission/page.tsx` | Static mission page. |
| `/solutions` | `app/solutions/page.tsx` | Static solutions page. |
| `/contact` | `app/contact/page.tsx` | Static contact page. |

## Frontend API Routes

| Route | File | Purpose |
| --- | --- | --- |
| `/api/flights` | `app/api/flights/route.ts` | Proxies browser flight searches to `Backend GET /flights`. |
| `/api/hotels` | `app/api/hotels/route.ts` | Proxies browser hotel searches to `Backend GET /hotels`. |

Shared API-route helpers live in `app/api/_utils`.
