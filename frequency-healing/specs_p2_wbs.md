# Healing Frequency Phase 2.0 - Work Breakdown Structure

| Area | Task | Priority | Est. Duration | Dependencies | Suggested Order | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Foundation | Add compositions columns (`audio_config`, `visualization_layers`, `intent`, `preset_id`, `source_composition_id`) | High | 0.5 day | None | 1 | Migration applies cleanly; existing rows unaffected; columns nullable and backward-compatible; generated types updated. |
| Foundation | Create `presets` table + seed initial presets | High | 0.5 day | Compositions columns | 2 | Presets are readable via API; at least 10 curated presets seeded; RLS allows public read only. |
| Foundation | Create `collab_sessions` + `collab_participants` tables | High | 1 day | Compositions columns | 3 | Host can create/update; participants can join/leave their own records; RLS enforced and tested. |
| Foundation | Create `biometric_samples` table | Medium | 0.5 day | Compositions columns | 4 | Users can insert/select only their own samples; session linkage works. |
| Foundation | Update RLS policies and indexes for new tables | High | 0.5 day | Rows 1-4 | 5 | Policies and indexes verified; no open access holes; explain plan shows index usage on hot queries. |
| Social | Comments table + RLS + UI thread | High | 1.5 days | None | 6 | Users can post/view comments; author profile data resolves; moderation constraints documented. |
| Social | Collections + collection_items + UI | High | 1.5 days | None | 7 | Users can create collections and add/remove compositions; duplicate inserts blocked. |
| Profiles | Profile editing UI (avatar/name/bio) | High | 1 day | Auth + profiles table | 8 | Owners can update profile fields; changes persist and render on profile/discover cards. |
| Discovery | Tags, filters, popular/trending sorting | High | 1.5 days | Compositions tags | 9 | Discover supports tag+intent filters; popular/trending sorting changes result order. |
| Audio | Custom frequency input UI + validation | High | 1 day | Row 1 | 10 | Users can add arbitrary Hz values; numeric constraints enforced (min/max/stepper); invalid inputs blocked with clear messages. |
| Audio | Harmonic/overtones helper | Medium | 1 day | Row 10 | 11 | One-click adds 2x/3x harmonics; harmonic volumes editable per tone; no duplicate frequencies inserted. |
| Audio | Rhythm pattern engine + randomizer | High | 2 days | Row 10 | 12 | Step-grid gates playback using `Tone.Transport`; randomizer yields valid patterns with at least one active step; BPM/subdivision persisted. |
| Audio | Modulation + sweep automation | High | 2 days | Rows 10, 12 | 13 | LFO (waveform/rate/depth) and sweep curves (linear/ease/exponential) alter frequency over time without clicks; config persisted. |
| Audio | Binaural beat mode (dual oscillators + panning) | High | 1 day | Row 10 | 14 | Left/right frequency offsets and stereo spread audible; headphone warning shown; safe defaults applied. |
| Audio | Persist `audio_config` to Supabase + load in editor | High | 1 day | Rows 10-14 | 15 | Saved compositions restore all advanced audio settings; legacy rows with null config load without errors. |
| Visuals | Add spiral/gradient/ripple renderers | High | 3 days | Visualization engine | 16 | New renderers selectable and parameterized; visuals align with reference motion style; desktop FPS stable. |
| Visuals | Audio-reactive particle system | Medium | 2 days | Row 16 | 17 | Particle motion reacts to amplitude/frequency bins; no frame drops/jank on mainstream devices. |
| Visuals | Sacred geometry renderer | Medium | 1.5 days | Row 16 | 18 | Flower/metatron-style geometry synced to energy; style parameters adjustable. |
| Visuals | Multi-layer compositor + blend modes | High | 2 days | Rows 16-18 | 19 | Users can stack layers, reorder, toggle, and blend (`screen`, `overlay`, etc.) with deterministic ordering. |
| Visuals | Visualization parameter UI + layer manager | High | 1.5 days | Rows 16-19 | 20 | Users can control colors/intensity/speed/scale per layer and manage stack (add/remove/reorder). |
| Visuals | Persist `visualization_layers` + load in editor | High | 1 day | Rows 19-20, Row 1 | 21 | Layer stack persists in JSONB and restores correctly; missing/legacy values safely normalized. |
| Mobile/Perf | Visual auto-downgrade strategy | High | 1 day | Rows 16-21 | 22 | Heavy visual stacks auto-reduce on low-power/mobile contexts; quality badge/fallback behavior documented. |
| Personalization | Preset library + time-of-day selector | Medium | 1 day | Presets table | 23 | Preset picker applies config; defaults align with morning/focus/sleep. |
| Personalization | Intent input + AI suggestion service | Medium | 1.5 days | Row 23 | 24 | Intent prompts return usable suggestions; selected intent saved on composition. |
| Remixing | Remix/fork flow + attribution | Medium | 1 day | Compositions columns | 25 | Forked sessions reference source composition; attribution visible in UI. |
| Collaboration | Realtime session creation + presence | Medium | 3 days | Collab tables | 26 | Hosts create sessions; participant presence updates in realtime; host role enforced. |
| Collaboration | Shared transport + state sync | Medium | 2 days | Row 26 | 27 | Play/stop and key parameter changes sync across users with acceptable latency. |
| Collaboration | Invite link + role controls UI | Medium | 1.5 days | Row 26 | 28 | Invites join session; host controls participant permissions. |
| Wearables | Web Bluetooth HR integration + fallback | Low | 2 days | Biometric samples table | 29 | Supported HR devices connect; manual input fallback works; samples stored. |
| Growth | Freemium gating + feature flags | Medium | 2 days | None | 30 | Premium-only features blocked without entitlement; upsell path visible. |
| Growth | Referral codes + redemption logging | Medium | 1 day | Referrals table | 31 | Codes tracked and redeemable; related events logged. |
| Analytics | Events logging + error reporting | Medium | 1 day | Events table | 32 | Core events instrumented; client/server errors include enough context for triage. |
| Accessibility | Accessibility pass for creator/discover | Medium | 1 day | UI components | 33 | Keyboard navigation, labels, and contrast checks pass for new controls. |
| QA | Regression + smoke test checklist | Medium | 1 day | All features | 34 | Checklist documented and executed; critical create/save/play/discover flows verified. |
