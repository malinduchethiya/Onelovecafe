# OneLove Café — Production Deployment & Operations Guide

## 1. Architecture Overview
- **Frontend & Routing**: Full-stack TypeScript application supporting direct URL entry and browser refresh across all public (`/`, `/menu`, `/story`, `/gallery`, `/events`, `/contact`, `/reserve`, `/reserve/voucher/:code`) and protected (`/admin/*`) routes.
- **Database & Auth**: Firebase Firestore (Enterprise Edition) with atomic `runTransaction` double-booking prevention, 10-minute ephemeral table holds (`reservationHolds` + `availability`), and Firebase Authentication (Google Sign-In + Role-Based Admin verification).
- **Server Validation**: Express API endpoints (`/api/reservations/validate`, `/api/inquiries/validate`) with Zod schema enforcement, honeypot spam protection, and sliding-window IP rate limiting.

## 2. Firestore Collections (16 Total)
All 16 collections are defined in `firebase-blueprint.json` and hardened in `firestore.rules`:
1. `admins` — Authorized administrator accounts (`super_admin`, `manager`, `host`)
2. `reservations` — Confirmed/managed bookings (PII isolated to admins after creation)
3. `reservationHolds` — 10-minute active checkout holds
4. `availability` — Non-PII deterministic table slot locks (`${date}_${time}_${tableId}`)
5. `tables` — Interactive floor plan coordinates, shapes, capacities, and VIP flags
6. `seatingZones` — Dining zones (Jungle Verandah, Stone Courtyard, Roastery Bar, Lotus Pavilion)
7. `openingHours` — Daily operating hours, slot durations, and grace periods
8. `blockedDates` — Full-day or partial-day closures and private buyouts
9. `menuCategories` — Culinary and beverage categories
10. `menuItems` — Dishes and drinks with LKR/USD pricing, dietary tags, and availability toggles
11. `gallery` — Curated architectural and culinary imagery
12. `events` — Acoustic nights, Ceylon coffee cuppings, and chef table gatherings
13. `siteContent` — Editable website hero, story, and section copy
14. `settings` — Global café contact details, coordinates, and reservation policies
15. `inquiries` — Public concierge & partnership inquiries (PII restricted to admins)
16. `auditLogs` — Immutable administrative activity logs

## 3. Deploying to Vercel & Appwrite Sites
### Vercel Deployment
1. Push repository to GitHub.
2. Import repository into Vercel.
3. Configure environment variables from `.env.example`.
4. Add your Vercel production domain to **Firebase Console → Authentication → Settings → Authorized domains**.

### Appwrite Sites Deployment
1. Connect the same GitHub repository in Appwrite Sites.
2. Set Build Command: `npm run build` and Start Command: `npm run start`.
3. Add the Appwrite Sites domain to **Firebase Console → Authentication → Settings → Authorized domains**.

## 4. Custom Domain & HTTPS Configuration
- Point your apex domain (`onelovecafe.lk`) via `A` record and `www` via `CNAME` to your hosting provider.
- Automatic Let's Encrypt TLS certificates are provisioned upon DNS verification.
- Update `APP_URL` to `https://onelovecafe.lk` for canonical URLs, `sitemap.xml`, and QR code vouchers.
