# Healing Frequency Phase 2.0 - Product Requirements Document (PRD)

## 1. Product Overview

Healing Frequency is a web-based healing frequency studio for wellness-conscious users and creators to compose, share, and explore meditative audio-visual content. Phase 1 delivered core features: frequency generator, visualizations, composition saving, and public sharing.

**Phase 2.0 Objective:** Elevate Healing Frequency from MVP to a creator-driven platform with advanced audio tools, richer visualization systems, collaboration, and personalization while laying the groundwork for monetization and retention.

---

## 2. Goals & Success Criteria

### Goals:

- Drive repeat usage by creators and listeners
- Improve discoverability and social validation features
- Add community and feedback loops (comments, collections, remixing)
- Expand creation depth with advanced audio controls
- Deliver immersive visuals with layered, audio-reactive scenes
- Build infrastructure for freemium model readiness
- Introduce personalization (presets, intent-based suggestions)

### Success Metrics:

- 25% increase in returning users (DAU/WAU ratio)
- 3x increase in average time spent per session
- 35% of new compositions use advanced audio features (custom input, modulation, binaural, rhythm)
- 25% of published compositions use new visual layers (spiral/gradient/ripple or multi-layer)
- 15% of weekly active creators use presets or AI suggestions
- 5% of weekly active creators participate in at least one collaborative session
- 99% crash-free sessions and <1% client error rate
- Foundational freemium gate live on at least one premium feature

---

## 3. Target Personas

- **Mindful Creators** (Yoga instructors, spiritual coaches, sound healers)
- **Frequency Explorers** (Wellness app users, meditators, Gen Z mindfulness seekers)
- **Sleep Seekers** (Users seeking custom sleep audio)
- **Digital Collectors** (Users who curate and share personalized compositions)
- **Co-Creators** (Users who want shared, real-time ritual sessions)

---

## 4. Features & User Stories

### A. Creator & Playback Enhancements

- **MP3 Export**
  - As a creator, I want to export my composition in MP3 format so I can use it on non-browser platforms.
- **Improved waveform control**
  - As a creator, I want to shape frequency transitions more precisely using fades and envelopes.
- **Custom frequency input**
  - As a creator, I want to enter any Hz value so I can match exact tuning needs.
  - As a listener, I want custom frequencies to align with my practice.
- **Randomized frequency mixing with rhythm patterns**
  - As a creator, I want one-click randomization of on/off patterns to discover new sessions quickly.
- **Frequency modulation and sweeps**
  - As a creator, I want to automate frequency changes over time (ramps or LFOs).
- **Binaural beat generator**
  - As a creator, I want to set different left/right channel frequencies for binaural effects.
- **Harmonic/overtones helper**
  - As a creator, I want to add harmonics (2x, 3x) to a base frequency with one action.

### B. Visualization & Render Upgrades

- **Psychedelic spiral visualization** (from `animation_examples/psychedelic-spiral.mdx`)
  - As a creator, I want a hypnotic spiral background that responds to audio energy.
- **Gradient animation visualization** (from `animation_examples/gradient-animation.mdx`)
  - As a creator, I want soft gradient flows that evolve with sound intensity.
- **Ripple effects visualization** (from `animation_examples/ripple.mdx`)
  - As a creator, I want ripples that pulse with the beat or amplitude.
- **Audio-reactive particle system**
  - As a listener, I want particles that bloom in response to frequency changes.
- **Sacred geometry patterns**
  - As a creator, I want mandala/geometry visuals that synchronize to harmony.
- **Multi-layer visualization composer**
  - As a creator, I want to combine multiple visual layers with blend modes.

### C. Community, Remixing & Collaboration

- **Comments on compositions**
  - As a listener, I want to leave feedback or thanks on a composition.
- **User playlists / collections**
  - As a user, I want to save and organize others' compositions.
- **Remix / fork compositions with attribution**
  - As a creator, I want to fork a session to create a new version while crediting the original.
- **Collaborative real-time composition sessions**
  - As a creator, I want to co-create in real time with a shared transport and controls.

### D. Discovery, Personalization & Growth

- **Tags and filters on Discover feed**
  - As a user, I want to filter compositions by tags (sleep, 432Hz, morning).
- **Popular and trending sorting**
  - As a user, I want to explore what others are listening to.
- **Time-of-day and mood presets**
  - As a user, I want presets that align with my morning, focus, or sleep routines.
- **AI-suggested frequency combinations based on intent**
  - As a creator, I want a suggestion engine that proposes combinations based on my intent.
- **Invite-a-friend referral system (non-auth based)**
  - As a user, I want to invite friends and get perks.

### E. Profiles & Social Proof

- **Profile customization**
  - As a user, I want to edit my profile image, display name, and bio.
- **Public follower count & links**
  - As a user, I want to see who follows whom for credibility and curiosity.

### F. Freemium, Analytics & Operational

- **Basic freemium gating**
  - As a creator, I want to unlock premium visuals/audio with an upgrade.
- **Basic event tracking** (composition plays, shares, saves)
- **Error reporting and crash logging**
- **Mobile UX tweaks for canvas and touch playback**

### G. Biometric Integrations

- **Wearable integration for biometric-responsive frequencies**
  - As a user, I want sessions to react to my heart rate or breathing pace.

---

## 5. Technical & Design Requirements

### Tech Stack Continuation:

- Next.js (TypeScript)
- Supabase (Auth, DB, Storage, Realtime)
- Tone.js for audio engine
- Canvas API + Three.js for visuals

### Audio Engine Requirements:

- Support arbitrary frequency values (numeric input + validation).
- Rhythm/pattern engine using Tone.Transport + Tone.Sequence / Part.
- Modulation engine with LFOs and automation curves for frequency sweeps.
- Binaural mode using dual oscillators and stereo panning.
- Harmonic helper to auto-generate overtones.
- Persist new audio settings in a serializable `audio_config` JSON schema.

### Visualization Requirements:

- New renderers sourced from `animation_examples` (psychedelic spiral, gradient animation, ripple).
- Audio-reactive particle system (Three.js or optimized Canvas).
- Sacred geometry renderer (flower-of-life / metatron style patterns).
- Multi-layer compositor with blend modes and per-layer parameters.
- Optional palette transitions and time-based visual automation.

### Collaboration Requirements:

- Supabase Realtime channels for shared state and presence.
- Host controls and synchronized transport/playback.
- Optional lightweight chat or activity feed per session.

### Personalization Requirements:

- Curated preset library for time-of-day and mood.
- AI suggestion service (rule-based baseline; optional LLM upgrade).
- Intent input field stored with compositions for discovery filters.

### Wearable Integration Requirements:

- Web Bluetooth support for heart-rate devices (fallback to manual input).
- Mapping layer that ties biometrics to modulation depth or rhythm intensity.

### Design Needs:

- Custom frequency input UI (min/max, stepper, preset quick-add).
- Modulation editor (LFO controls, sweep curves).
- Rhythm pattern builder (step grid + randomize).
- Binaural controls with headphone guidance.
- Visualization layer picker and parameter drawers.
- Collaboration session UI (invite link, participant list, host controls).

### Supabase Migrations (Tables & Policies):

**New/Updated Columns**
- `compositions`: add `audio_config` (JSONB), `visualization_layers` (JSONB), `intent` (TEXT), `preset_id` (UUID), `source_composition_id` (UUID).

**New Tables**
- `presets` (id, name, description, tags, time_of_day, config, created_at)
- `collab_sessions` (id, host_id, status, created_at, ended_at)
- `collab_participants` (session_id, user_id, role, joined_at, left_at)
- `biometric_samples` (id, user_id, session_id, metric_type, value, created_at)

**Existing Tables (Phase 2 continuation)**
- `comments`, `collections`, `collection_items`, `followers`, `events`, `referrals`

**Indexes**
- `idx_compositions_intent`, `idx_compositions_preset_id`, `idx_collab_sessions_host_id`.

> Note: Tags are currently stored in `compositions.tags` (array). A normalized `tags`/`composition_tags` model can be added later if advanced search requires it.

### RLS Policies (Additions):

- `presets`: public read, admin write.
- `collab_sessions`: host create/update; participants read.
- `collab_participants`: users can join/leave their own entries.
- `biometric_samples`: insert/select by owner only.
- `events`: write-only per user (existing).

### API Contract (REST endpoints):

- `POST /api/comments` → Add comment
- `GET /api/comments?composition_id=` → List comments
- `POST /api/collections` → Create collection
- `POST /api/collections/:id/add` → Add composition to collection
- `GET /api/collections/:user_id` → Get user collections
- `GET /api/discover?sort=popular|trending&tag=sleep&intent=focus` → Discover feed
- `PATCH /api/profile` → Update profile info
- `POST /api/follow/:user_id` → Follow/unfollow
- `POST /api/referral/use` → Claim referral code
- `POST /api/track` → Log event
- `GET /api/presets?time_of_day=morning` → List presets
- `POST /api/presets/:id/use` → Apply preset
- `POST /api/suggestions` → Intent-based suggestion payload
- `POST /api/collab/session` → Create collaborative session
- `POST /api/collab/:id/join` → Join session
- `POST /api/collab/:id/leave` → Leave session
- `POST /api/remix/:id` → Fork composition with attribution
- `POST /api/biometrics` → Log biometric samples

---

## 6. Implementation Phases

### Phase 1 (Weeks 1-2) - Social & Discovery Core

- Comments (UI + backend)
- Collections/playlists (save others' content)
- Profile editing (avatar, bio)
- Tags + discover filters + popular/trending sorting

### Phase 2 (Weeks 3-4) - Audio Creation Enhancements

- Custom frequency input
- Rhythm pattern generator + randomizer
- Modulation and sweep automation
- Binaural beat generator
- Harmonic helper + audio_config persistence

### Phase 3 (Weeks 5-6) - Visualization Upgrades

- Psychedelic spiral, gradient animation, ripple renderers
- Audio-reactive particle system
- Sacred geometry renderer
- Multi-layer compositor with blend modes

### Phase 4 (Weeks 7-8) - Personalization & Growth

- Time-of-day/mood presets
- AI suggestion engine
- Remix/fork flow
- Freemium gating + referral tracking
- Analytics baseline

### Phase 5 (Week 9+) - Collaboration & Integrations

- Real-time collaborative sessions (presence + sync)
- Wearable biometrics integration
- Mobile performance + accessibility pass
- UI polish and microinteractions

---

## 7. Work Breakdown Structure (WBS)

| Area        | Task                                          | Priority | Est. Duration | Dependencies                  |
| ----------- | --------------------------------------------- | -------- | ------------- | ----------------------------- |
| Audio       | Custom frequency input + validation           | High     | 1 day         | Audio engine update           |
| Audio       | Rhythm pattern generator + randomizer         | High     | 2 days        | Tone.Transport scheduling     |
| Audio       | Modulation + sweep automation                 | High     | 2 days        | Audio config persistence      |
| Audio       | Binaural beat mode                            | High     | 1 day         | Stereo routing support        |
| Visuals     | Spiral/gradient/ripple renderers              | High     | 3 days        | Renderer framework            |
| Visuals     | Audio-reactive particle system                | Medium   | 2 days        | Analyzer + Three.js           |
| Visuals     | Sacred geometry renderer                      | Medium   | 1.5 days      | Canvas/Three.js utilities     |
| Visuals     | Multi-layer compositor                        | High     | 2 days        | New renderers                 |
| Social      | Remix/fork flow                               | Medium   | 1 day         | Composition schema update     |
| Growth      | Preset library + time-of-day filters          | Medium   | 1 day         | Presets table                 |
| Growth      | AI suggestions (intent-based)                 | Medium   | 1.5 days      | Intent capture UI             |
| Collab      | Realtime session creation + presence          | Medium   | 3 days        | Supabase Realtime             |
| Collab      | Shared transport sync                         | Medium   | 2 days        | Collab session base           |
| Freemium    | Feature gating + referral tracking            | Medium   | 2 days        | Supabase tables + flags       |
| Analytics   | Event tracking + error reporting              | Medium   | 1 day         | Middleware + logging          |

> Detailed WBS with dependencies, acceptance criteria, and ordering lives in `specs_p2_wbs.md`.

---

## 8. Open Questions

- What premium features will be gated first in freemium tier?
- Should comments support emojis or just plain text?
- What guardrails are needed for collaborative sessions (host-only controls vs shared)?
- What wearable devices should be supported at launch?
- Should AI suggestions be rule-based only, or allow optional external LLMs?

---

## 9. Risks & Mitigations

- **Realtime sync complexity** → Start with host-controlled sessions + limited shared controls.
- **WebGL performance on mobile** → Auto downgrade to lighter visuals.
- **Binaural audio misuse** → Add headphone warnings + safe defaults.
- **Wearable compatibility** → Offer manual input fallback.
- **Suggestion quality** → Launch with curated rules before LLM integration.

---

## 10. Deliverables Summary

- Advanced audio creation tools (custom input, modulation, binaural, patterns)
- New visualization suite + multi-layer composer
- Presets, intent-based suggestions, and remixing
- Collaboration sessions with realtime sync
- Wearable-responsive experiences
- Freemium gating + referrals + analytics
