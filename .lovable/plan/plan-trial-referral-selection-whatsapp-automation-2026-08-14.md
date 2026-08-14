# Plan: Trial Referral Selection & WhatsApp Automation

Implement server, screens, and trial hours selection in the admin approval modal for referrals, with validation and automatic WhatsApp notification.

## Technical Details

### 1. Database Schema Update
- Add `trial_hours` column to `public.trial_signups` to store the selected trial duration.
- Migration: `ALTER TABLE public.trial_signups ADD COLUMN IF NOT EXISTS trial_hours integer;`

### 2. Backend (Edge Function: `referrals-api`)
- Implement `addHoursISO(hours: number)` for precise expiration calculation.
- Define `SERVER_TELAS_MAP` and `SERVER_HORAS_MAP` constants for server-specific constraints.
- Update `approve-signup` action to:
    - Validate `servidor`, `telas`, and `trial_hours` inputs.
    - Map `servidor` to a readable label for TopGestor observations.
    - Use `addHoursISO` for the TopGestor `data_de_vencimento`.
    - Record `trial_hours` in the `trial_signups` table.
    - Automatically send a WhatsApp welcome message using `sendWhatsappText` from `uazapi.ts`.

### 3. Frontend (Admin Panel: `TrialSignupsTab.tsx`)
- Update `ApproveModal` to include state for `servidor`, `telas`, and `horas`.
- Add server-specific selection logic (filtering available screens/hours based on server).
- Include the new fields in the API request body.
- Reset dependent fields when the server changes.

## User Interface Changes
- New dropdowns in the Approval Modal:
    - **Servidor**: Uniplay P2P, Uniplay IPTV, Warez.
    - **Telas**: Dynamic based on server.
    - **Horas**: Dynamic based on server (1h, 2h, 3h, 6h, etc.).
- The WhatsApp credentials modal will no longer be strictly necessary as a manual step if the auto-send works, but will be kept as a fallback.
