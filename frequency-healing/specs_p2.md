# Healing Frequency Phase 2.0 - Product Requirements Document (PRD)

## 1. Product Overview

Healing Frequency is a web-based healing frequency studio for wellness-conscious users and creators to compose, share, and explore meditative and frequency-based audio-visual content. Phase 1 MVP delivered core features: frequency generator, visualizations, composition saving, and public sharing.

**Phase 2.0 Objective:** Elevate Healing Frequency from MVP to a creator-driven platform with improved social features, discoverability, and user engagement, preparing for monetization and long-term retention.

---

## 2. Goals & Success Criteria

### Goals:

* Drive repeat usage by creators and listeners
* Improve discoverability and social validation features
* Add community and feedback loops (e.g. comments, collections)
* Increase shareability and visibility of compositions
* Build infrastructure for freemium model readiness

### Success Metrics:

* 25% increase in returning users (DAU/WAU ratio)
* 3x increase in average time spent per session
* 500+ saved compositions with >=1 like/comment
* Foundational freemium logic implemented

---

## 3. Target Personas

* **Mindful Creators** (Yoga instructors, spiritual coaches, sound healers)
* **Frequency Explorers** (Wellness app users, meditators, Gen Z mindfulness seekers)
* **Sleep Seekers** (Users seeking custom sleep audio)
* **Digital Collectors** (Users who curate and share personalized compositions)

---

## 4. Features & User Stories

### A. Creator & Playback Enhancements

* **MP3 Export**

  * As a creator, I want to export my composition in MP3 format so I can use it on non-browser platforms.
* **Improved waveform control**

  * As a creator, I want to shape frequency transitions more precisely.

### B. Community & Feedback

* **Comments on Compositions**

  * As a listener, I want to leave feedback or thanks on a composition.
  * As a creator, I want to engage with my audience.
* **User Playlists / Collections**

  * As a user, I want to save and organize others' compositions.

### C. Discovery & Growth

* **Tags and Filters on Discover Feed**

  * As a user, I want to filter compositions by tags (e.g. sleep, 432Hz, morning).
* **Popular and Trending Sorting**

  * As a user, I want to explore what others are listening to.

### D. Profiles & Social Proof

* **Profile Customization**

  * As a user, I want to edit my profile image, display name, and bio.
* **Public Follower Count & Links**

  * As a user, I want to see who follows whom for credibility and curiosity.

### E. Growth Infrastructure

* **Basic Freemium Gating**

  * As a creator, I want to export or unlock premium visuals/audio with an upgrade.
* **Invite-a-friend Referral System (Non-auth based)**

  * As a user, I want to invite friends and get perks.

### F. Analytics & Operational

* **Basic Event Tracking** (composition plays, shares, saves)
* **Error Reporting and Crash Logging**
* **Mobile UX Tweaks for canvas and touch playback**

---

## 5. Technical & Design Requirements

### Tech Stack Continuation:

* Next.js (TypeScript)
* Supabase (Auth, DB, Storage)
* Tone.js for audio engine
* Canvas API + Three.js for visuals

### Design Needs:

* Profile editing UI
* Comment thread component
* Playlist UI mockups
* Tag filter and popular sorting
* Mobile-optimized components

### Supabase Migrations (Tables & Policies):

* `comments` (id, user_id, composition_id, content, created_at)
* `collections` (id, user_id, name, is_public, created_at)
* `collection_items` (collection_id, composition_id)
* `tags` (id, label)
* `composition_tags` (composition_id, tag_id)
* `followers` (follower_id, followed_id)
* `events` (user_id, event_type, metadata, timestamp)
* `referrals` (code, referred_user_id, referrer_user_id, created_at)

### RLS Policies:

* `comments`: insert/select/update/delete by owner or public composition viewer
* `collections`: only owner can edit/delete
* `followers`: users can only follow/unfollow others
* `events`: write-only per user

### API Contract (REST endpoints):

* `POST /api/comments` → Add comment
* `GET /api/comments?composition_id=` → List comments
* `POST /api/collections` → Create collection
* `POST /api/collections/:id/add` → Add composition to collection
* `GET /api/collections/:user_id` → Get user collections
* `GET /api/discover?sort=popular|trending&tag=sleep` → Discover feed
* `PATCH /api/profile` → Update profile info
* `POST /api/follow/:user_id` → Follow/unfollow
* `POST /api/referral/use` → Claim referral code
* `POST /api/track` → Log event

---

## 6. Implementation Phases

### Phase 1 (Weeks 1-2) - Social & Feedback Core

* Comments (UI + backend)
* Collections/playlists (save others' content)
* Profile editing (avatar, bio)

### Phase 2 (Weeks 3-4) - Discovery Upgrade

* Tags on composition creation
* Tag filters and sorting logic
* Popular/trending sorting

### Phase 3 (Weeks 5-6) - Growth & Retention Infra

* Basic freemium gating logic (feature-level locks)
* Invite-a-friend tracking & redemption
* Analytics (page views, saves, exits)
* Mobile canvas tweaks

### Phase 4 (Week 7+) - Creator Experience Polish

* MP3 export (Tone.js to MP3 pipeline)
* Audio gradient/fade support
* UI transitions and microinteractions

---

## 7. Work Breakdown Structure (WBS)

| Area        | Task                                        | Priority | Est. Duration | Dependencies               |
| ----------- | ------------------------------------------- | -------- | ------------- | -------------------------- |
| Comments    | Build Supabase `comments` table + RLS       | High     | 0.5 day       | None                       |
| Comments    | UI for comment thread                       | High     | 1 day         | Supabase schema            |
| Comments    | API endpoints for comment CRUD              | High     | 1 day         | Supabase schema            |
| Collections | `collections` and `collection_items` tables | High     | 0.5 day       | None                       |
| Collections | Create/save compositions to collections UI  | High     | 1 day         | Supabase                   |
| Profiles    | UI for editing avatar, name, bio            | High     | 1 day         | Auth profile setup         |
| Discover    | Tag model + tagging in composition creation | High     | 0.5 day       | Composition create flow    |
| Discover    | Add filters, sorting logic to discover feed | High     | 1.5 days      | Tag data                   |
| Freemium    | Gating logic for export/premium visuals     | Medium   | 2 days        | Feature flag infra         |
| Freemium    | Referral codes + usage logging              | Medium   | 1 day         | Supabase `referrals` table |
| Analytics   | Supabase `events` table + logging API       | Medium   | 1 day         | Global middleware          |
| Mobile UX   | Canvas & audio tweaks for mobile            | High     | 1 day         | QA required                |
| MP3 Export  | Tone.js export + conversion pipeline        | Medium   | 2 days        | Existing export utils      |

---

## 8. Open Questions

* What premium features will be gated first in freemium tier?
* Should comments support emojis or just plain text?
* How will we handle abuse/moderation in comments?
* What incentive do users get for inviting friends?

---

## 9. Risks & Mitigations

* **Too much scope** → Split into milestone-based deploys
* **Spam/abuse in comments** → Add rate limit + optional moderation queue
* **Export performance issues** → Delay MP3 if performance unacceptable

---

## 10. Deliverables Summary

* Commenting system
* Tag & discovery improvements
* Profile and social proof features
* Basic monetization infrastructure
* Creator export & polish upgrades
