# 📸 Estado do Sistema — Antes da Refatoração (2026-03-06)

## Commit de Referência
- Tag Git: `backup-pre-refactor`
- Branch: `main`

## schema.prisma — 25 modelos

| Modelo | Estado | Observações |
|--------|--------|-------------|
| `User` | ✅ Estável | 42 campos. Sem relação com LoyaltyPoints (relação implícita via userId) |
| `Service` | ✅ Estável | Tem `PackageOption[]` vinculado. Campo `travelFee` é String? |
| `PackageOption` | ✅ Estável | Vinculado a Service (cascade delete) |
| `Package` | ✅ Estável | Controle de sessões compradas por paciente |
| `Appointment` | ✅ Estável | Campos de split payment como JSON string (`splitPayments`, `addons`) |
| `Payment` | ⚠️ Incompleto | **Falta:** `gateway` (String?) e `feeAmount` (Float?) para DRE com maquininhas |
| `LoyaltyPoints` | ⚠️ Risco P2002 | `userId @unique` — upserts concorrentes causam constraint violation |
| `LoyaltyTransaction` | ⚠️ Incompleto | **Falta:** `reason` (String?) para ajustes manuais. Types `MANUAL_ADD`/`MANUAL_SUBTRACT` não estão no enum (é String livre) |
| `LoyaltyReward` | ✅ Estável | Soft-delete com `active` |
| `Schedule` | ✅ Estável | `dayOfWeek @unique`, com breakStart/breakEnd opcionais |
| `Anamnese` | ✅ Estável | 40+ campos de saúde. `userId @unique` |
| `BodyMeasurement` | ✅ Estável | Fotos front/side/back como URLs |
| `SessionFeedback` | ✅ Estável | `appointmentId @unique` |
| `GiftCard` | ✅ Estável | Código único, saldo, status |
| `InventoryItem` / `StockMovement` | ✅ Estável | Cascade delete |
| `TreatmentProtocol` | ✅ Estável | Steps como JSON string |
| `DigitalReceipt` | ✅ Estável | `appointmentId @unique` |
| `ReferralCode` / `Referral` | ✅ Estável | Indicação com status |
| `Waitlist` | ✅ Estável | Por serviço/data |
| `EmailVerificationToken` | ✅ Estável | Token único |

## ⚠️ Modelos que NÃO EXISTEM ainda
- `SiteSettings` (CMS: whatsapp, heroTitle, aboutText)

## Lógica de Pontos — Estado Atual (BUGGY)
1. **Arquivo:** `app/api/admin/appointments/route.ts` (linhas 109-140)
2. **Comportamento:** Dá `POINTS_SESSION = 50` fixos por sessão COMPLETED (ignorando valor do pacote)
3. **Problema P2002:** `upsert` + `$transaction` sequencial cria race condition. Dois webhooks simultâneos tentam criar o mesmo `LoyaltyPoints` → crash
4. **Sem idempotência:** Não verifica se já deu pontos para o mesmo `appointmentId` (referenceId) → se o admin marca COMPLETED duas vezes, ganha pontos dobrados

## Webhook Mercado Pago — Estado Atual
1. **Arquivo:** `app/api/payments/webhook/route.ts` (210 linhas)
2. **Anti-duplicata de Package:** ✅ Verifica via `findFirst({ userId, packageOptionId, status: ACTIVE })`
3. **Anti-duplicata de Payment:** ✅ Verifica via `description contains mpid:{id}`
4. **NÃO concede pontos:** O webhook ativa pacotes mas **não** dá pontos de fidelidade (correto — pontos devem ser por sessão COMPLETED)

## next.config.ts
- `remotePatterns` já inclui `lh3.googleusercontent.com` ✅
- Output `standalone`, security headers completos
- CSP configurado para MP, GA, Facebook, Cloudflare
