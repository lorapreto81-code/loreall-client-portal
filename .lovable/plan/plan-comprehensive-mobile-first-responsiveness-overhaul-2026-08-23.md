# Plan: Comprehensive Mobile-First Responsiveness Overhaul

Make the application 100% responsive and mobile-first, ensuring a premium experience across all devices (320px to 1920px).

## User Review Required

> [!IMPORTANT]
> - This update refactors existing layouts to use a mobile-first approach.
> - Tables will be replaced with responsive card lists or scrollable containers on small screens.
> - Navigation will transition to a more robust mobile-friendly drawer/hamburger menu.

## Proposed Changes

### 1. Global Layout & Typography
- Implement a fluid typography system using Tailwind `clamp` or standard responsive prefixes.
- Standardize spacing using a consistent spacing scale (Tailwind `gap`, `p`, `m`).
- Ensure all touch targets meet the minimum 44x44px requirement.

### 2. Navigation & Header
- **Mobile:** Implement a standardized mobile header with hamburger menu/drawer across all pages.
- **Desktop:** Sidebar or top-bar navigation that adapts gracefully.
- Refactor `DashboardHeader.tsx` and `DashboardNavigation.tsx` for better mobile ergonomics.

### 3. Page-Specific Responsiveness
- **Login:** Optimize `BannerRotativo` and form sizing for small screens (iPhone SE/320px).
- **Dashboard:** Improve `PlanCard` and action buttons layout. Ensure `LaunchesBanner` maintains aspect ratio correctly.
- **Admin:** (Technical Challenge) Convert large tables in `ResellerLinksTab`, `ResellerPurchasesTab`, etc., into responsive cards on mobile.
- **Instalacao:** Already partially optimized, but ensure all images and accordions behave well on high-res desktops.
- **Revendedor:** Hardened responsiveness for the credit selection slider and PIX QR code displays.

### 4. Interactive Elements
- Ensure all modals, sheets, and bottom sheets use a consistent mobile-first behavior.
- Optimize form inputs (phone, CPF, etc.) for mobile keyboards (`inputMode`).

## Technical Details
- **Architecture:** Transition from fixed widths (like `max-w-[480px]`) to flexible containers with `w-full` and appropriate `max-w` at larger breakpoints.
- **CSS:** Use `@media` queries via Tailwind classes (`sm:`, `md:`, `lg:`, `xl:`) starting from the base (mobile) style.
- **Assets:** Ensure all `lovable-assets` pointers are used with `w-full` and `h-auto` or `object-cover`.
- **Validation:** Test against Chromium Mobile emulation and various desktop resolutions.

