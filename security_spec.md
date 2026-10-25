# OneLove Café — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default Deny Catch-All**: Unmatched paths (`/{document=**}`) deny all reads and writes unconditionally.
2. **Verified Admin Governance (`isAdmin()`)**: Only authenticated users with `request.auth.token.email_verified == true` whose email matches the bootstrapped owner (`merlinfiverr0@gmail.com`) or whose UID exists in `/admins/$(request.auth.uid)` may manage catalog, floor plan, settings, or view PII collections (`/reservations`, `/inquiries`, `/admins`, `/auditLogs`).
3. **PII Isolation (Split Collection Pattern)**:
   - `/reservations/{reservationId}` and `/inquiries/{inquiryId}` store guest PII (`guestEmail`, `whatsapp`, `phone`, `message`). Public guests can `create` validated documents with `createdAt == request.time`, but `get` and `list` are strictly restricted to `isAdmin()`.
   - `/availability/{slotId}` stores zero PII (`date`, `time`, `tableId`, `status`, `holdExpiresAtMs`, `sessionId`, `referenceCode`, `updatedAt`) so the interactive floor plan can query table status safely without exposing guest contact details.
4. **Path Variable Hardening (`isValidId`)**: Every single-document target operation (`get`, `create`, `update`, `delete`) validates its path ID (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
5. **Strict Key & Size Enforcement (`hasAll` + `hasOnly` + `.size()`)**: Every `isValid[Entity]` helper enforces exact allowed keys, required keys, string length boundaries, numeric boundaries, and server timestamp equality (`request.time`).
6. **Terminal State & Action-Based Updates**: Updates require `isValid[Entity](incoming())` and `incoming().updatedAt == request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Shadow Field Injection on Reservation Create**:
   `{ ...validReservation, "isAdminOverride": true }` -> Rejected by `data.keys().hasOnly(...)`.
2. **Unverified Admin Email Spoof**:
   Auth token `{ email: "merlinfiverr0@gmail.com", email_verified: false }` attempting `get /reservations/res_1` -> Rejected by `request.auth.token.email_verified == true`.
3. **PII Scraping on `/reservations`**:
   Unauthenticated or non-admin signed-in user calling `list /reservations` or `get /reservations/res_1` -> Rejected by `allow get, list: if isAdmin()`.
4. **PII Scraping on `/inquiries`**:
   Non-admin user calling `get /inquiries/inq_1` -> Rejected by `allow get, list: if isAdmin()`.
5. **Client Timestamp Forgery**:
   Reservation payload with `createdAt: Timestamp(2020, 1, 1)` instead of `request.time` -> Rejected by `incoming().createdAt == request.time`.
6. **1MB String Resource Exhaustion (Denial of Wallet)**:
   Inquiry payload with `message` of 50,000 characters -> Rejected by `data.message.size() <= 1000`.
7. **ID Poisoning Attack**:
   Creating `/reservations/invalid$id!with@spaces` -> Rejected by `isValidId(reservationId)`.
8. **Privilege Escalation via `/admins` Self-Registration**:
   Non-admin user calling `create /admins/attacker_uid` -> Rejected by `allow create: if isAdmin() && ...`.
9. **Unauthorized Menu Price Tampering**:
   Public guest calling `update /menuItems/item_1` with `{ priceUsd: 0 }` -> Rejected by `allow update: if isAdmin() && ...`.
10. **Reservation Status Forgery on Create**:
    Public guest creating a reservation with `status: "completed"` -> Rejected by `incoming().status == 'confirmed'`.
11. **Audit Log Deletion / Tampering**:
    Any user attempting `update` or `delete` on `/auditLogs/log_1` -> Rejected by `allow update, delete: if false`.
12. **Availability Slot Poisoning with PII**:
    Attempting to inject `guestEmail` into `/availability/2026-10-30_19-00_T1` -> Rejected by `isValidAvailabilitySlot` strict `hasOnly` check.
