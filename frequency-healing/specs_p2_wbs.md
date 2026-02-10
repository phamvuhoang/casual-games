# Healing Frequency Phase 2.0 - Work Breakdown Structure

| Area | Task | Priority | Est. Duration | Dependencies | Suggested Order | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- | --- |
| Foundation | Add compositions columns (`audio_config`, `visualization_layers`, `intent`, `preset_id`, `source_composition_id`) | High | 0.5 day | None | 1 | Migration applies cleanly; existing rows unaffected; types updated. |
| Foundation | Create `presets` table + seed initial presets | High | 0.5 day | Compositions columns | 2 | Presets are readable; at least 10 curated presets seeded. |
| Foundation | Create `collab_sessions` + `collab_participants` tables | High | 1 day | Compositions columns | 3 | Host can create; participants can join/leave; RLS enforced. |
| Foundation | Create `biometric_samples` table | Medium | 0.5 day | Compositions columns | 4 | Users can insert/select their own samples only. |
| Foundation | Update RLS policies and indexes for new tables | High | 0.5 day | Rows 1-4 | 5 | Policies and indexes verified; no open access holes. |
| Social | Comments table + RLS + UI thread | High | 1.5 days | None | 6 | Users can post/view comments; author info loads. |
| Social | Collections + collection_items + UI | High | 1.5 days | None | 7 | Users can create collections and add/remove compositions. |
| Profiles | Profile editing UI (avatar/name/bio) | High | 1 day | Auth + profiles table | 8 | Owners can update profile fields; changes persist. |
| Discovery | Tags, filters, popular/trending sorting | High | 1.5 days | Compositions tags | 9 | Discover supports filters; sorting changes results. |
| Audio | Custom frequency input UI + validation | High | 1 day | Row 1 | 10 | Users can add arbitrary Hz values; validation blocks invalid input. |
| Audio | Harmonic/overtones helper | Medium | 1 day | Custom frequency input | 11 | One-click adds harmonics with editable volumes. |
| Audio | Rhythm pattern engine + randomizer | High | 2 days | Custom frequency input | 12 | Patterns gate sound; randomize produces valid patterns. |
| Audio | Modulation + sweep automation | High | 2 days | Custom frequency input | 13 | LFO/sweeps alter frequency over time; values persist. |
| Audio | Binaural beat mode (dual oscillators + panning) | High | 1 day | Custom frequency input | 14 | Left/right offsets audible; headphone warning shown. |
| Audio | Persist `audio_config` to Supabase + load in editor | High | 1 day | Rows 10-14 | 15 | Saved compositions restore advanced audio settings. |
| Visuals | Add spiral/gradient/ripple renderers | High | 3 days | Visualization engine | 16 | New visual types selectable; smooth render on desktop. |
| Visuals | Audio-reactive particle system | Medium | 2 days | Renderer framework | 17 | Particle activity responds to amplitude without jank. |
| Visuals | Sacred geometry renderer | Medium | 1.5 days | Renderer framework | 18 | Geometry visual syncs to frequency energy. |
| Visuals | Multi-layer compositor + blend modes | High | 2 days | Rows 16-18 | 19 | Users can stack layers; blend modes apply correctly. |
| Visuals | Visualization parameter UI + presets | Medium | 1.5 days | Rows 16-19 | 20 | Users can adjust colors, intensity, and layer order. |
| Personalization | Preset library + time-of-day selector | Medium | 1 day | Presets table | 21 | Preset picker applies config; defaults set by time-of-day. |
| Personalization | Intent input + AI suggestion service | Medium | 1.5 days | Preset library | 22 | Intent prompts return usable frequency suggestions. |
| Remixing | Remix/fork flow + attribution | Medium | 1 day | Compositions columns | 23 | Forked sessions reference source composition. |
| Collaboration | Realtime session creation + presence | Medium | 3 days | Collab tables | 24 | Hosts create sessions; presence list updates in realtime. |
| Collaboration | Shared transport + state sync | Medium | 2 days | Realtime sessions | 25 | Play/stop + parameter changes sync across users. |
| Collaboration | Invite link + role controls UI | Medium | 1.5 days | Realtime sessions | 26 | Invites join session; host controls enforced. |
| Wearables | Web Bluetooth HR integration + fallback | Low | 2 days | Biometric samples table | 27 | Supported HR devices connect; manual input fallback works. |
| Growth | Freemium gating + feature flags | Medium | 2 days | None | 28 | Premium-only features blocked without upgrade. |
| Growth | Referral codes + redemption logging | Medium | 1 day | Referrals table | 29 | Codes tracked and redeemable; events logged. |
| Analytics | Events logging + error reporting | Medium | 1 day | Events table | 30 | Key events captured; errors report with context. |
| Mobile/Perf | Mobile canvas/audio optimization | High | 1.5 days | Visuals + audio features | 31 | Mobile FPS stable; audio latency acceptable. |
| Accessibility | Accessibility pass for creator/discover | Medium | 1 day | UI components | 32 | Keyboard navigation and ARIA coverage validated. |
| QA | Regression + smoke test checklist | Medium | 1 day | All features | 33 | Checklist documented; critical flows tested. |
