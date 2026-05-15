# Frontend API Helpers And Types

This folder holds reusable frontend logic, typed API clients, and shared data types.

| File | Purpose |
| --- | --- |
| `api-url.ts` | Builds the backend API base URL from `NEXT_PUBLIC_API_URL`. |
| `auth.ts` | Stores logged-in user data, access token helpers, and role checks. |
| `approval-requests.ts` | Creates, reads, and updates travel approval requests. |
| `approval-analytics.ts` | Builds dashboard analytics from approval request data. |
| `admin-users.ts` | Calls admin/manager user-management endpoints. |
| `travel.ts` | Converts approval request data into dashboard/trip display models. |
| `flights.ts` | Flight search types and SearchAPI mapping logic used by the backend route layer. |
| `hotels.ts` | Hotel search result types shared by pages and API code. |
