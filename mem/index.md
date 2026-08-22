# Project Memory

## Core
TopGestor API token must stay server-side — all calls go through the `topgestor-proxy` edge function.
Fast Depix PIX is used for renewals < R$ 500.
Referral bonus (+30 days) goes to the REFERRER.

## Memories
- [Security Hardening](mem://security/hardening-audit) — Audit results and mitigation strategies, including ignored findings.
Telefones: sempre armazenar/enviar dígitos com DDI (E.164 sem "+"), via componente `PhoneInput` + helpers em `src/utils/countries.ts`. Backend casa por sufixo (≥8 dígitos), então registros antigos sem 55 continuam válidos.
