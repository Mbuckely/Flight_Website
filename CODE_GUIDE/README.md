# RideTEGO Flight Website Code Guide

This folder explains the project in plain language: how to run it, where the important files are, and how the main features work.

## 1. How To Run The Project

Open two PowerShell terminals.

### Terminal 1: Run The Backend

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Backend
npm install
npm start
```

The backend runs on:

```txt
http://localhost:5000
```

You should see:

```txt
Server running on port 5000
```

### Terminal 2: Run The Frontend

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Frontend
npm install
npm run dev
```

The frontend runs on:

```txt
http://localhost:3000
```

Open this in the browser:

```txt
http://localhost:3000
```

## 2. Environment Files

The backend needs a `.env` file inside:

```txt
Backend/.env
```

It should include values like:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=5000
FRONTEND_URL=http://localhost:3000
SEARCHAPI_API_KEY=your-searchapi-key
```

The frontend needs a `.env.local` file inside:

```txt
Frontend/.env.local
```

It can include:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-browser-key
```

Never push real `.env` files to GitHub.

## 3. Project Structure

```txt
Flight_website
├── Backend
│   ├── server.js
│   ├── supabaseClient.js
│   └── supabase-schema.sql
├── Frontend
│   ├── app
│   ├── components
│   └── lib
└── CODE_GUIDE
    └── README.md
```

## 4. Backend Overview

The main backend file is:

```txt
Backend/server.js
```

This file creates the Express server and handles:

- Signup
- Login
- Profile lookup/update
- Flight search
- Hotel search
- Approval requests
- Admin/manager user role management
- Password reset

The Supabase client is created in:

```txt
Backend/supabaseClient.js
```

The database setup notes are in:

```txt
Backend/supabase-schema.sql
```

## 5. Frontend Overview

The frontend is a Next.js app.

Important folders:

```txt
Frontend/app
Frontend/components
Frontend/lib
```

### Main Pages

```txt
Frontend/app/page.tsx
```

Home page.

```txt
Frontend/app/book-flight/page.tsx
```

Main booking page for flights and hotels.

```txt
Frontend/app/dashboard/page.tsx
```

Dashboard for employees, managers, and admins.

```txt
Frontend/app/approvals/page.tsx
```

Manager/admin approval review page.

```txt
Frontend/app/admin/users/page.tsx
```

Admin/manager user management page.

```txt
Frontend/app/login/page.tsx
Frontend/app/signup/page.tsx
```

Authentication pages.

## 6. Role System

The app uses three main roles:

```txt
employee
manager
admin
```

There is also old support for:

```txt
approver
```

But the current idea is:

- `manager` means approver.
- `admin` controls the system.
- `employee` submits travel requests.

### Employee

Employees can:

- Search flights
- Search hotels
- Select flight and/or hotel
- Submit a travel request to a manager/admin
- View their own approved trips

Employees cannot:

- Approve requests
- Manage users
- Promote anyone

### Manager

Managers can:

- Approve travel requests
- See the Users tab
- See employee users
- Promote employees to managers

Managers cannot:

- Create admins
- Change admins
- Demote admins

### Admin

Admins can:

- See all users
- Change roles between employee, manager, and admin
- See approval tools
- Manage the system

The Users page is here:

```txt
Frontend/app/admin/users/page.tsx
```

The backend routes for user management are in:

```txt
Backend/server.js
```

Look for:

```txt
GET /admin/users
PATCH /admin/users/:id/role
```

## 7. How To Make The First Admin

Create the account normally through the app signup.

Then in Supabase SQL Editor, run:

```sql
alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('employee', 'approver', 'manager', 'admin'));

update public.profiles
set role = 'admin'
where lower(email) = 'internship@ridetego.com';
```

Then log out and log back in.

## 8. Booking Flow

The main booking page is:

```txt
Frontend/app/book-flight/page.tsx
```

It has two main tabs:

- Stays
- Flights

### Flights

Users can:

- See popular live flight options
- Search flights dynamically
- Select a flight
- Add a hotel/stay if needed
- Submit the selected flight to a manager

Flight cards are rendered using:

```txt
Frontend/components/flights/FlightCard.tsx
```

Airport prediction input is:

```txt
Frontend/components/flights/AirportField.tsx
```

Flight types live in:

```txt
Frontend/lib/flights.ts
```

### Hotels / Stays

Users can:

- See popular stays automatically
- Search hotels by city/state/country
- Use destination predictions
- Filter/sort by price, rating, reviews, etc.
- Select a hotel
- Add a flight if needed
- Submit the trip to a manager

Hotel types live in:

```txt
Frontend/lib/hotels.ts
```

Google place predictions live in:

```txt
Frontend/components/places/GooglePlaceField.tsx
```

## 9. API Routes

There are two layers of API routes:

1. Frontend API proxy routes
2. Backend Express routes

### Frontend API Proxy Routes

These live in:

```txt
Frontend/app/api
```

Flights proxy:

```txt
Frontend/app/api/flights/route.ts
```

Hotels proxy:

```txt
Frontend/app/api/hotels/route.ts
```

These routes forward requests from the browser to the backend.

This helps keep secret API keys out of the browser.

### Backend API Routes

These live in:

```txt
Backend/server.js
```

Important backend routes:

```txt
GET /flights
GET /hotels
POST /signup
POST /login
GET /profile
PATCH /profile
GET /managers
GET /approval-requests
POST /approval-requests
PATCH /approval-requests/:id
GET /admin/users
PATCH /admin/users/:id/role
POST /forgot-password
POST /reset-password
```

## 10. Flight And Hotel APIs

The app uses SearchAPI for:

- Google Flights
- Google Hotels

The API key is read from:

```txt
Backend/.env
```

```env
SEARCHAPI_API_KEY=your-searchapi-key
```

The key is only used in the backend.

That means the browser does not see the real SearchAPI key.

### How SearchAPI Is Used

The app does not store every flight or hotel in Supabase.

Instead, flights and hotels are searched live through SearchAPI.

The flow looks like this:

```txt
Browser
  -> Frontend API route
  -> Backend Express route
  -> SearchAPI
  -> Backend formats the response
  -> Frontend displays cards
```

### Flight Search Flow

Frontend page:

```txt
Frontend/app/book-flight/page.tsx
```

Frontend proxy route:

```txt
Frontend/app/api/flights/route.ts
```

Backend route:

```txt
Backend/server.js
GET /flights
```

SearchAPI engine used:

```txt
google_flights
```

The backend builds a SearchAPI request with values like:

- departure airport
- arrival airport
- outbound date
- return date
- trip type
- travel class
- stops
- passenger count
- max price

Then it sends the request to:

```txt
https://www.searchapi.io/api/v1/search
```

The backend maps the SearchAPI flight response into a simpler format for the frontend.

That formatted data is what the flight cards use.

### Hotel Search Flow

Frontend page:

```txt
Frontend/app/book-flight/page.tsx
```

Frontend proxy route:

```txt
Frontend/app/api/hotels/route.ts
```

Backend route:

```txt
Backend/server.js
GET /hotels
```

SearchAPI engine used:

```txt
google_hotels
```

The backend builds a SearchAPI request with values like:

- destination search text
- check-in date
- check-out date
- number of adults
- sort option
- max price
- rating
- free cancellation

Then it sends the request to:

```txt
https://www.searchapi.io/api/v1/search
```

The backend maps the SearchAPI hotel response into a simpler hotel object for the frontend.

That formatted data is what the hotel cards use.

### Why SearchAPI Is Backend-Only

SearchAPI requires a private API key.

The frontend should never expose that key.

That is why the browser calls:

```txt
/api/flights
/api/hotels
```

and those frontend routes call the backend:

```txt
GET /flights
GET /hotels
```

Only the backend reads:

```env
SEARCHAPI_API_KEY
```

### API Caching

SearchAPI calls can be slow and cost money.

The backend has a small in-memory cache for repeated flight and hotel searches.

If the same search happens again within a short time, the backend can return the cached result instead of calling SearchAPI again.

The frontend also stores popular flight and stay results in browser session storage so the page can show common results faster.

Important note:

```txt
The cache is temporary. It is not the source of truth.
```

SearchAPI is still the live source for flight and hotel availability.

## 10.5 Supabase Database

Supabase is the database and authentication system for the app.

Supabase handles:

- user accounts
- profile records
- roles
- approval requests
- saved approved trip data

### Supabase Auth

Supabase Auth stores the actual login account.

This includes:

- user id
- email
- encrypted password handled by Supabase
- auth session

The app does not store passwords manually.

When a user logs in, the backend uses Supabase Auth to verify the email/password.

### Profiles Table

The app also has a `profiles` table.

This table stores app-specific user information:

```txt
profiles
```

Common columns:

```txt
id
email
phone
first_name
last_name
role
created_at
```

The `id` should match the Supabase Auth user id.

The `role` controls what the user can do.

Allowed roles:

```txt
employee
manager
admin
```

The older role `approver` may still exist for compatibility, but the current system treats `manager` as the approver role.

### Approval Requests Table

Travel requests are stored in:

```txt
approval_requests
```

This table stores:

- title
- submitted person
- assigned approver
- route
- travel dates
- room needs
- traveler names
- selected flight/hotel details
- request reason
- status

Important columns:

```txt
id
title
submitted_by
approver_email
approver_name
from_location
to_location
route
travel_dates
room_requirement
travelers
booking_details
reason
status
requested_at
itinerary_shared
created_at
updated_at
```

The `booking_details` column is JSON.

It can store selected flight and hotel information, for example:

```json
{
  "flight": {
    "airline": "Delta",
    "from": "JFK",
    "to": "LAX",
    "duration": "6h 10m",
    "price": 320
  },
  "stay": {
    "name": "Example Hotel",
    "price": "$1,200",
    "priceValue": 1200
  }
}
```

### What Is Stored In Supabase Vs SearchAPI

Supabase stores app data:

- users
- roles
- travel requests
- selected itinerary details after a user submits a request

SearchAPI provides live travel search data:

- flight search results
- hotel search results
- prices
- airline details
- hotel ratings
- hotel images
- amenities

The app does not save every SearchAPI result to Supabase.

It only saves selected booking details when an employee submits a request.

### Role Management In Supabase

Admins and managers manage roles through the app.

The frontend page is:

```txt
Frontend/app/admin/users/page.tsx
```

The backend routes are:

```txt
GET /admin/users
PATCH /admin/users/:id/role
```

The backend updates the `profiles.role` value in Supabase.

That means when someone is promoted to manager, the change is saved in the database.

After they log out and log back in, the app recognizes their new role.

### Important Supabase SQL

Make sure the `profiles` table allows the app roles:

```sql
alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('employee', 'approver', 'manager', 'admin'));
```

To make the first admin manually:

```sql
update public.profiles
set role = 'admin'
where lower(email) = 'internship@ridetego.com';
```

To see all profiles:

```sql
select id, email, first_name, last_name, phone, role, created_at
from public.profiles
order by created_at desc;
```

To see approval requests:

```sql
select *
from public.approval_requests
order by created_at desc;
```

## 11. Reusable Helpers

The frontend has reusable helper files in:

```txt
Frontend/lib
```

Important ones:

```txt
Frontend/lib/api-url.ts
```

Figures out the backend API URL.

```txt
Frontend/lib/auth.ts
```

Handles stored logged-in user info and role helpers.

```txt
Frontend/lib/approval-requests.ts
```

Handles approval request API calls.

```txt
Frontend/lib/admin-users.ts
```

Handles admin/manager user management API calls.

```txt
Frontend/lib/flights.ts
Frontend/lib/hotels.ts
```

Shared flight and hotel data types.

## 12. Approval Requests

Approval requests are stored in Supabase table:

```txt
approval_requests
```

The backend creates and updates approval requests.

Employees submit requests.

Managers/admins review and approve them.

Approvals page:

```txt
Frontend/app/approvals/page.tsx
```

Backend routes:

```txt
GET /approval-requests
POST /approval-requests
PATCH /approval-requests/:id
```

## 13. Dashboard

Dashboard page:

```txt
Frontend/app/dashboard/page.tsx
```

Employee dashboard shows:

- Upcoming trips
- Previous trips
- Quick actions

Manager/admin dashboard shows:

- Active trips
- Pending approvals
- Monthly spend based on real approved request prices
- Traveler compliance based on real request statuses

No fake hardcoded monthly spend or compliance values are used now.

## 14. Common Development Commands

### Backend

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Backend
npm start
```

### Frontend

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Frontend
npm run dev
```

### Check Frontend TypeScript

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Frontend
npx tsc --noEmit
```

### Check Frontend Lint

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Frontend
npm run lint
```

### Check Backend Syntax

```powershell
cd C:\Users\marqu\TegoMB\Flight_website\Backend
node --check server.js
```

## 15. Git Commands

From the project root:

```powershell
cd C:\Users\marqu\TegoMB\Flight_website
git add -A
git commit -m "Update project"
git push origin main
```

If pushing to the TegoIntern remote:

```powershell
git push tego main
```
