# Frequency Healing Monetization Spec

Date: February 21, 2026
Owner: Product + Engineering
Status: Proposed

---

## 1) Objective

Design and implement a paid/subscription model that:

1. Preserves guest-first first value on `/create`.
2. Converts high-intent users into paid subscribers without hurting top-of-funnel activation.
3. Monetizes the advanced modules (Voice Bioprint, Adaptive Journey, Breath Sync, Quantum Intention, Harmonic Field, Sympathetic Resonance) with clear value ladders.
4. Is implementable on the current stack (Next.js + Supabase) with low operational risk.

---

## 2) Research Summary (What Matters for Pricing/Model)

As of February 21, 2026:

1. Subscription market behavior
- RevenueCat (State of Subscription Apps 2025): annual plans can produce meaningfully higher revenue than monthly in many categories; health/fitness trial conversion pressure increased versus prior years.
- Recurly (State of Subscriptions 2026): trial conversion declined year-over-year across surveyed businesses; annual plans and cancellation recovery flows outperformed; pause options and hybrid models showed strong upside.

2. Category pricing anchors (wellness/audio)
- Calm lists annual and lifetime tiers (including family/lifetime variants).
- Insight Timer MemberPlus: annual-first pricing.
- Brain.fm: monthly + annual membership structure.
- Waking Up: monthly + annual and an explicit scholarship path.

3. Market demand
- McKinsey continues to frame wellness as a large global market (~$1.8T), with sustained consumer spending in mental, sleep, and mindfulness-adjacent categories.

Implication for this product:

1. Lead with annual as default anchor, keep monthly as entry.
2. Keep free value strong, because trial conversion in the category is getting tougher.
3. Add downgrade-safe options (pause, module pass, scholarship) to reduce hard churn.

---

## 3) Monetization Strategy for Current Features

### 3.1 Core model

Use a hybrid model:

1. Subscription core: recurring revenue for full advanced experience.
2. Module passes (out-of-the-box): low-commitment paid unlock path for users not ready for full subscription.
3. Scholarship mode: no-questions access request for users with affordability constraints (trust + brand moat, inspired by Waking Up style accessibility).

### 3.2 Why this is out-of-the-box but practical

Most apps choose only one: hard paywall or broad freemium. This model adds a third path:

1. Subscription for power users.
2. Paid module passes for commitment-shy users.
3. Scholarship to capture goodwill and long-term retention.

This increases conversion surface without forcing users into an immediate all-or-nothing decision.

---

## 4) Proposed Plans and Pricing (v1)

All prices USD, A/B tested over time.

1. Free Guest (no account)
- Instant playback, presets, frequency stack basics.
- Local draft only.
- Advanced modules visible as preview cards.

2. Free Account
- Cloud save (limited), profile, discover participation.
- Limited advanced access via trial/passes only.

3. Studio Plus (subscription)
- Monthly: $12.99
- Annual: $79.99 (default highlighted option)
- Includes all advanced modules, unlimited saves, publish/share tools, advanced session history.

4. Studio Pro (phase 2, optional)
- Monthly: $24.99
- Annual: $179.99
- Adds creator/pro tooling: longer exports, priority processing, analytics depth, commercial-use toggle.

5. Module Passes (out-of-the-box)
- Single module 7-day pass: $4.99
- Advanced Bundle 7-day pass (all modules): $9.99
- Pass purchase credits are deductible from first annual subscription purchase within 14 days.

6. Scholarship Access
- 3-month Plus scholarship on request from pricing page.
- Renewal workflow based on simple reconfirmation.

---

## 5) Feature Entitlement Matrix

| Capability | Guest | Free Account | Plus | Pro |
| --- | --- | --- | --- | --- |
| Preset playback + base visuals | Yes | Yes | Yes | Yes |
| Custom frequency stack (core controls) | Yes | Yes | Yes | Yes |
| Save locally | Yes | Yes | Yes | Yes |
| Cloud save | No | Limited (ex: 10) | Unlimited | Unlimited |
| Publish to profile/discover | No | Limited | Unlimited | Unlimited |
| Voice Bioprint | Preview only | Trial/Pass only | Yes | Yes |
| Sympathetic Resonance | Preview only | Trial/Pass only | Yes | Yes |
| Adaptive Binaural Journey | Preview only | Trial/Pass only | Yes | Yes |
| Breath Sync Protocol | Preview only | Trial/Pass only | Yes | Yes |
| Quantum Intention Mapping | Preview only | Trial/Pass only | Yes | Yes |
| Harmonic Field Generator | Preview only | Trial/Pass only | Yes | Yes |
| Advanced historical analytics | No | No | Basic | Full |
| Priority support | No | No | No | Yes |

Notes:

1. Keep first value ungated: playback and core stack stay free.
2. Monetize depth and continuity, not initial experimentation.

---

## 6) Conversion Journey (Landing -> First Value -> Paid)

### 6.1 Experience flow

1. Landing -> `/create` guest session starts instantly.
2. After first value event (`ftue_first_play_started`), prompt account creation for cloud save and continuity.
3. On first locked module click:
- Offer `Start 7-day All Modules Trial` (no card) OR `Buy Module Pass` OR `Sign in`.
4. During trial, show usage-aware nudges:
- "You used Breath Sync 3 times this week. Keep your progress with Plus."
5. Trial ending:
- Annual default + monthly fallback + scholarship link + pass fallback.
6. Cancellation:
- Offer pause (1-2 months), downgrade to passes, or scholarship.

### 6.2 Paywall placement principles

1. Place paywall after demonstrated value moments (module interaction, save intent, progress streak), not at first visit.
2. Keep at least one non-paid path always visible (continue free).
3. Explain exactly what unlocks (module-level bullets).

---

## 7) Implementation Plan (Engineering)

## Phase 1: Billing foundation (1-2 weeks)

1. Add Stripe billing backend.
2. Add Supabase billing tables + entitlement layer.
3. Add pricing page and checkout portal.
4. Replace `userId`-only module gating with entitlement checks.

Deliverables:

1. Dependencies
- `stripe` package.

2. DB migration `011_billing_core.sql`
- `billing_customers`
- `billing_subscriptions`
- `billing_entitlements`
- `billing_events`
- `billing_module_passes`
- `billing_scholarships`

3. API routes
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/webhooks/stripe` (replace current placeholder)
- `GET /api/billing/entitlements`

4. App integration
- New hook: `useEntitlements()`
- Update `FrequencyCreator.tsx` gating:
  - from `Boolean(userId)` to module checks like `canUse('voice_bioprint')`
- Keep preview cards + deep-link return behavior.

5. Security
- Verify Stripe webhook signatures.
- Server-side entitlement checks for all paid actions (not only UI gating).
- RLS by `auth.uid()` for billing rows.

## Phase 2: Out-of-the-box layer (1-2 weeks)

1. Module passes with checkout + expiry.
2. Scholarship request + approval flow.
3. Cancellation pause flow.
4. Usage-aware upgrade nudges.

Deliverables:

1. UI components
- `PricingCard`
- `ModulePassSheet`
- `ScholarshipModal`
- `SubscriptionStatusBadge`

2. Billing logic
- Pass consumption/activation per module and period.
- Scholarship as entitlement source with expiry.

## Phase 3: Optimization and experimentation (ongoing)

1. A/B test price points and annual discount depth.
2. Test no-card trial vs card-required trial.
3. Tune module pass pricing and upsell timing.
4. Add win-back campaigns at churn signals.

---

## 8) Suggested Database Schema (v1)

```sql
-- Core customer mapping
create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscription state mirror
create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'stripe',
  provider_subscription_id text not null unique,
  plan_code text not null, -- plus_monthly, plus_annual, pro_monthly, etc
  status text not null, -- trialing, active, past_due, canceled, paused
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Entitlements used by product gates
create table if not exists public.billing_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entitlement_code text not null, -- adv_voice_bioprint, adv_breath_sync, studio_plus_all
  source text not null, -- subscription, module_pass, scholarship, admin
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_entitlements_user_code_active
  on public.billing_entitlements(user_id, entitlement_code, is_active);

-- Webhook and billing event audit trail
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Optional module pass transactions
create table if not exists public.billing_module_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_code text not null,
  status text not null, -- active, expired, refunded
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  provider_checkout_id text,
  created_at timestamptz not null default now()
);

-- Scholarship requests
create table if not exists public.billing_scholarships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending, approved, denied, expired
  note text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

## 9) Instrumentation and Success Metrics

Track in analytics and warehouse:

1. Activation
- `landing_to_first_play_rate`
- `first_play_to_signup_rate`

2. Monetization
- `trial_start_rate`
- `trial_to_paid_rate`
- `pass_purchase_rate`
- `annual_share_of_new_subscriptions`
- `mrr`, `arr`, `arpa`, `ltv`

3. Retention/Churn
- `d30_paid_retention`
- `voluntary_churn_rate`
- `recovered_cancellation_rate` (save offer/pause/pass)

4. Target ranges (first 90 days)
- First play -> signup: 10-18%
- Signup -> trial/pass: 20-35%
- Trial -> paid: 25-40%
- New paid annual mix: 45-65%

---

## 10) Risks and Mitigations

1. Risk: hurting free acquisition with aggressive paywalls.
- Mitigation: keep core playback + basic stack free; trigger paywalls only after value events.

2. Risk: subscription fatigue.
- Mitigation: module passes + scholarship path + pause option.

3. Risk: entitlement mismatch across client/server.
- Mitigation: server-authoritative checks + webhook reconciliation jobs.

4. Risk: claim credibility for experimental modules.
- Mitigation: keep wellness framing, avoid medical promises, maintain disclaimers.

---

## 11) Rollout Plan

1. Week 1-2
- Build billing core and Plus plan.
- Launch internal/staging with fake cards.

2. Week 3
- Launch to 10-20% traffic with annual-vs-monthly paywall A/B.

3. Week 4
- Turn on module passes for non-converting cohort.

4. Week 5+
- Add scholarship and cancellation pause.

---

## 12) Source References

Research sources used for this spec:

1. RevenueCat - State of Subscription Apps 2025  
[https://www.revenuecat.com/state-of-subscription-apps-2025/](https://www.revenuecat.com/state-of-subscription-apps-2025/)

2. Recurly - State of Subscriptions 2026  
[https://recurly.com/research/state-of-subscriptions](https://recurly.com/research/state-of-subscriptions)

3. Calm plans page  
[https://www.calm.com/freetrial/plans](https://www.calm.com/freetrial/plans)

4. Brain.fm pricing  
[https://www.brain.fm/pricing](https://www.brain.fm/pricing)

5. Insight Timer subscription page  
[https://insighttimer.com/subscription](https://insighttimer.com/subscription)

6. Waking Up subscription and scholarship pages  
[https://www.wakingup.com/subscription](https://www.wakingup.com/subscription)  
[https://www.wakingup.com/scholarship](https://www.wakingup.com/scholarship)

7. McKinsey wellness market report  
[https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/feeling-good-the-future-of-the-1-point-8-trillion-global-wellness-market](https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/feeling-good-the-future-of-the-1-point-8-trillion-global-wellness-market)
