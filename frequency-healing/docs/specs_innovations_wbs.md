# Healing Frequency - Innovation Validation + WBS (Phase 2/3)

Date: 2026-02-17  
Inputs reviewed:
- `frequency-healing/specs_new_ideas.md`
- `frequency-healing/specs_wbs.md`
- Existing implementation in `frequency-healing/lib/audio/*`, `frequency-healing/lib/visualization/*`, `frequency-healing/components/audio/FrequencyCreator.tsx`, and current Supabase migrations/types.

## 1) Context Review Summary (6 Proposed Features)

1. Voice Bioprint (vocal frequency analysis and personalized tone generation).
2. Sympathetic Resonance Tuner (room analysis and harmonization/cancellation modes).
3. Adaptive Binaural Brain States (dynamic state journeys with entrainment sweeps).
4. Solfeggio Harmonic Field Generator (multi-tone interference fields + cymatics-style visuals).
5. Breath-Sync Frequency Protocol (mic-inferred breathing, paced toward coherence).
6. Quantum Intention Imprinting (intention text/voice mapped to frequency modulation).

---

## 2) Research and Validation by Methodology

Evidence scale used:
- High: replicated, peer-reviewed evidence with clinical/physiology signal.
- Moderate: mixed but credible evidence with small-to-medium effects.
- Low: limited evidence, small samples, or weak controls.
- Very low: mostly unvalidated or controversial claims.

### 2.1 Methodology Validation Matrix

| Methodology | Scientific Basis (peer-reviewed) | Technical Feasibility in Browser | UX Considerations / Friction | Evidence Strength |
| --- | --- | --- | --- | --- |
| Tomatis Method (auditory processing therapy) | Cochrane review for autism sound therapies found no strong supporting evidence for AIT/Tomatis as a treatment standard. Small studies exist but are heterogeneous and often underpowered. | Feasible to implement the *mechanics* (filtered listening, vocal analysis feedback) with `getUserMedia`, `AnalyserNode`, Tone.js. Not feasible to support clinical claims. | Must avoid medical framing. Users may expect diagnosis; onboarding must explicitly frame as exploratory wellness audio personalization. | Low |
| BioAcoustic Biology (Sharry Edwards) / vocal frequency analysis | No robust mainstream peer-reviewed validation for BioAcoustic Biology as diagnostic science. Related field of voice biomarkers is active and promising but still limited by dataset bias, reproducibility, and clinical generalization gaps. | Strong feasibility for extracting FFT peaks, formants, spectral centroid, jitter/shimmer proxies in browser (Web Audio + optional AudioWorklet). | Main friction is trust: users need transparent "how this was computed" explanations and confidence indicators. Mic permission + background noise handling required. | Low for BioAcoustic claims, Moderate for generic voice biomarker analytics |
| Sympathetic resonance in acoustic ecology | Resonance physics is well-established. Active noise control literature shows cancellation can work in constrained geometries, but quiet zones are spatially limited and sensitive to latency/placement. Natural soundscape studies support stress-reduction benefits. | Browser implementation feasible for room-spectrum monitoring and harmonics generation. Robust real-room "cleanse" cancellation is only partially feasible with consumer mic/speaker latency and unknown transfer functions. | Continuous mic permission may feel invasive. Users may interpret "cleanse" as guaranteed noise removal; UI must set realistic expectations and provide calibration feedback. | Moderate for resonance physics, Low-Moderate for consumer room-cancellation claims |
| Brainwave entrainment (Monroe/Hemi-Sync lineage) | Meta-analyses/reviews report mixed-to-positive effects (especially anxiety/stress and some cognitive outcomes), with heterogeneity across protocols. Some controlled trials show benefit; others show null effects. | Highly feasible: existing Tone.js stereo pathways already support binaural offsets; add journey scheduling and dynamic beat transitions in `FrequencyGenerator`. | Headphone requirement is critical; users need clear setup checks. Sessions longer than ~20 min need progress cues and early exits to reduce drop-off. | Moderate |
| Solfeggio frequencies + Pythagorean tuning | Limited small studies (e.g., 432/440 comparisons, small 528-related studies) suggest possible relaxation/autonomic effects, but evidence is inconsistent and not sufficient for strong biological claims (for example DNA repair). | Easy to synthesize and layer frequencies using Tone.js oscillator banks and panners. Real-time interference visualization is feasible via Canvas/WebGL approximations. | Users like presets, but too many mystical claims can reduce credibility. Need "traditional tuning mode" vs "research-backed mode" labeling. | Low-Moderate |
| Coherent breathing / HRV coherence (HeartMath-adjacent) | Stronger evidence base than most alternatives: slow breathing around resonance frequency (~0.1 Hz / ~5-6 breaths per min) is linked to HRV improvement and autonomic regulation; HRV biofeedback meta-analyses show meaningful stress/anxiety benefits. | Feasible for guided breathing without sensors. Mic-based breath inference works for coarse phase detection; true HRV requires PPG/ECG or wearable integration (Web Bluetooth optional). | Lowest friction when no hardware required. Must provide fallback manual pacing if mic permission denied or ambient noise is high. | Moderate-High |
| Emoto Water Experiment + cymatics | Emoto-style intention/water-structure claims are highly controversial with weak reproducibility and poor methodological controls. Cymatics itself (pattern formation from vibration) is physically valid. | Intention-to-frequency mapping is technically easy. What is not feasible is proving intention imprints physical matter in the product context. Cymatics visuals are feasible as simulations. | Must be explicitly labeled "reflective/ritual mode" and not scientific therapy. Good viral potential, but high credibility risk if positioned as fact. | Very low for Emoto claims, High for cymatics physics |

### 2.2 Practical Scientific Positioning

- Safe to position as evidence-aligned wellness tooling:
  - Breath-Sync Protocol.
  - Adaptive Binaural Journeys (with conservative claims).
  - Voice Bioprint as personalization (not diagnosis).
- Should be positioned as experimental/creative:
  - Sympathetic Room Cleanse.
  - Solfeggio Harmonic Field therapeutic claims.
  - Quantum Intention Imprinting.

---

## 3) Implementation Plan (WBS)

Format mirrors existing WBS docs, but expanded with atomic tasks, dependencies, requirements, and acceptance criteria.

## Phase 2 Foundation (shared for all 6 features)

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Add innovation config schema v2 | Extend `AudioConfigShape` with optional innovation modules (`voiceBioprint`, `breathSync`, `adaptiveJourney`, `harmonicField`, `intention`). | 0.5 day | `frequency-healing/lib/audio/audioConfig.ts`, `frequency-healing/components/audio/FrequencyCreator.tsx` | TypeScript types + backward-compatible parser | Legacy compositions load safely; new configs parse and persist without runtime errors. |
| Add microphone analysis service | Introduce shared mic stream + analyser helper for voice, room, and breath features. | 1.5 days | `frequency-healing/lib/audio/FrequencyGenerator.ts`, `frequency-healing/components/audio/FrequencyCreator.tsx` | `getUserMedia`, `MediaStreamAudioSourceNode`, `AnalyserNode`, permission state handling | One stream can feed all enabled modules; clean teardown; no dangling tracks. |
| Create innovation DB scaffolding | Add composition-level innovation columns + feature-specific tables with RLS. | 1 day | `frequency-healing/supabase/migrations/004_phase2_audio_visual_config.sql`, `frequency-healing/lib/supabase/types.ts` | Supabase migration + regenerated TS types | Migration applies cleanly and keeps existing rows/query paths backward compatible. |
| Add consent + scientific disclaimer UX | Introduce copy and toggles that separate wellness guidance from medical claims. | 0.5 day | `frequency-healing/components/audio/FrequencyCreator.tsx`, `frequency-healing/components/ui/Modal.tsx` | UI text system + persisted consent flags | Features with controversial claims cannot run until user acknowledges disclaimer. |
| Add telemetry/perf guardrails | Capture permission-denied rates, analysis confidence, and frame/perf metrics. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx`, `frequency-healing/lib/visualization/VisualizationEngine.ts` | Lightweight event logging endpoint | P95 analysis loop remains stable on mainstream mobile and desktop. |

Estimated shared foundation total: **4.5 days**

---

## Feature 1 - Voice Bioprint

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Voice capture workflow | Add 5-10s guided mic capture with noise-floor check and retry flow. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | `getUserMedia`, mic permission, AGC/noise-suppression settings | User can complete capture in <=2 attempts in normal room noise. |
| Spectral feature extraction | Compute FFT bins, dominant peaks, centroid, band energy, and stability score. | 1.5 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` (analyser conventions), new `frequency-healing/lib/audio/VoiceBioprintEngine.ts` | Web Audio FFT (2048/4096), smoothing | Engine outputs deterministic profile JSON from same input sample. |
| Personalized recommendation map | Map underrepresented bands to recommended frequencies with confidence scoring. | 1.5 days | `frequency-healing/lib/audio/mixProfiles.ts`, `frequency-healing/lib/utils/constants.ts` | Rule-based mapping table (versioned JSON) | Returns max 3 recommended frequencies + transparent "why" metadata. |
| Inject recommendations into mix | One-click "Apply to Session" pushes suggestions into existing stack/gains. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx`, `frequency-healing/lib/audio/mixProfiles.ts` | Existing add/toggle frequency flows | Applied frequencies play immediately and save in `audio_config`. |
| Frequency Portrait visualization | Render "voice DNA" portrait from spectral vectors. | 1 day | `frequency-healing/components/audio/WaveformVisualizer.tsx`, `frequency-healing/lib/visualization/renderers/CompositorRenderer.ts` | Canvas renderer layer | Portrait updates after each capture and exports in session thumbnail/video. |
| Persist profile history | Store summary metrics and recommendations for later comparison. | 1 day | `frequency-healing/lib/supabase/types.ts` + new migration | Supabase table + RLS | User sees last N captures and trend deltas in UI. |
| QA and claim-safety pass | Copy review, edge-case testing (permission denied, noisy room, iOS). | 0.5 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Browser/device matrix tests | No medical diagnosis language; fallback path always available. |

Estimated total: **7.5 days**

### Integration Strategy

- `FrequencyGenerator`:
  - No fundamental rewrite needed.
  - Add helper method to accept recommendation payload and rebalance active voices.
- Tone.js/audio path:
  - Reuse existing `buildFrequencyMix` and per-frequency gain model.
- Visualization:
  - Add `voice_portrait` overlay layer in compositor.
- Supabase:
  - New table `voice_profiles` + optional `compositions.voice_profile_id`.
- New UI:
  - `components/audio/VoiceBioprintPanel.tsx`
  - `components/audio/VoicePortraitCard.tsx`

---

## Feature 2 - Sympathetic Resonance Tuner

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Continuous room analysis loop | Sample room spectrum every 2-5s with smoothing/debounce. | 1.5 days | `frequency-healing/components/audio/FrequencyCreator.tsx`, shared mic service | `AnalyserNode`, moving average filter | Dominant room frequencies remain stable (no rapid UI jitter). |
| Harmonize mode | Generate harmonics/partials from detected dominant frequency set. | 1.5 days | `frequency-healing/lib/audio/mixProfiles.ts`, `frequency-healing/lib/audio/FrequencyGenerator.ts` | Tone.js oscillator bank + limiter | Harmonize mode adds tones without clipping and can be toggled live. |
| Cleanse mode (bounded prototype) | Implement phase-offset cancellation attempt for narrowband tones only. | 2 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` | Inverted phase synthesis, latency compensation heuristic | UI clearly indicates limited cancellation zone; no "guaranteed silence" claims. |
| Room map visualization | Add rolling heatmap/spectrum waterfall of room frequencies. | 2 days | `frequency-healing/lib/visualization/VisualizationEngine.ts`, `frequency-healing/components/audio/WaveformVisualizer.tsx` | Canvas/WebGL heatmap renderer | Live map updates at >=20 FPS on desktop and >=12 FPS on mobile. |
| Session controls + calibration | Add mode switch, calibration, and confidence meter. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Permission handling + UX copy | User can calibrate in <30s and see confidence state (low/medium/high). |
| Persist room scans | Store dominant bands and mode used for analytics/history. | 1 day | Supabase migration + `frequency-healing/lib/supabase/types.ts` | `room_scans` table + RLS | Each session stores summary row linked to composition/user. |
| QA/performance tuning | Validate behavior in headphones/speakers and noisy environments. | 1 day | `frequency-healing/components/audio/WaveformVisualizer.tsx` | Device/browser QA | No runaway CPU or feedback loops under continuous monitoring. |

Estimated total: **10 days**

### Integration Strategy

- `FrequencyGenerator`:
  - Add `setRoomCompensation(config)` to control harmonize/cleanse overlays.
- Tone.js/audio path:
  - Use dedicated gain bus for room-response tones to avoid clipping existing session.
- Visualization:
  - Add `RoomSpectrumRenderer`.
- Supabase:
  - New table `room_scans`.
- New UI:
  - `components/audio/RoomTunerPanel.tsx`
  - `components/audio/RoomFrequencyMap.tsx`

---

## Feature 3 - Adaptive Binaural Brain States

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Journey schema and presets | Add journey model (state steps, durations, beat ranges). | 1 day | `frequency-healing/lib/audio/audioConfig.ts`, `frequency-healing/lib/utils/constants.ts` | Versioned config JSON | 4 intents available: Sleep, Focus, Meditation, Creativity. |
| Dynamic journey scheduler | Schedule beat transitions over 20-40 minute timelines. | 2 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` | `Tone.Transport` automation updates | Beat transitions are smooth, click-free, and recover from pause/resume. |
| Binaural UX and guardrails | Add headphone check and safety hints before start. | 0.5 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Device capability checks | Non-headphone users get clear warning and can continue in mono fallback. |
| Micro-adaptation (optional mic) | Use breath cadence trend to nudge journey speed by bounded delta. | 1.5 days | shared mic service, `frequency-healing/lib/audio/FrequencyGenerator.ts` | Breath-phase estimator + bounded control loop | Adaptation never exceeds configured safe bounds. |
| Visual state sync | Update palette/speed by active brain-state segment. | 1 day | `frequency-healing/lib/visualization/config.ts`, `frequency-healing/lib/visualization/renderers/CompositorRenderer.ts` | Layer automation mapping | Visual changes match journey timeline and remain readable. |
| Save/load + analytics | Persist journey config and completion metrics. | 1 day | `frequency-healing/lib/supabase/types.ts`, `frequency-healing/components/audio/FrequencyCreator.tsx` | Supabase columns/tables | Reopening composition restores full journey and last state. |
| QA | Cross-browser transport stability + long-session memory tests. | 0.5 day | `frequency-healing/lib/audio/FrequencyGenerator.ts` | 30+ minute soak tests | No drift/crashes in long-running sessions. |

Estimated total: **7.5 days**

### Integration Strategy

- `FrequencyGenerator`:
  - Extend existing binaural + automation framework (already present in Phase 2 code).
  - Add journey-level scheduler that composes with `setAutomation`.
- Tone.js/audio path:
  - Reuse dual-oscillator panned setup from current `binaural` flow in `mixProfiles`.
- Visualization:
  - Add "brain state timeline" overlay synced to current journey step.
- Supabase:
  - New table `journey_templates`; optional `compositions.journey_config`.
- New UI:
  - `components/audio/BinauralJourneyPanel.tsx`
  - `components/audio/JourneyProgressBar.tsx`

---

## Feature 4 - Solfeggio Harmonic Field Generator

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Solfeggio field presets | Add preset sets and blend ratios for multi-frequency fields. | 1 day | `frequency-healing/lib/utils/constants.ts`, `frequency-healing/lib/audio/mixProfiles.ts` | Config presets with versioning | At least 6 curated field presets are available and editable. |
| Interference engine | Compute and synthesize beat/interference components safely. | 1.5 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` | Oscillator bank, limiter/compressor | No clipping at max preset stack; output remains stable. |
| Spatial motion | Add optional 3D panning trajectories for field layers. | 1.5 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` | `PannerNode` automation | Spatial mode can be toggled without audio dropouts. |
| Cymatics-style visual renderer | Simulate nodal pattern visuals driven by frequency differences. | 2.5 days | `frequency-healing/lib/visualization/renderers/CompositorRenderer.ts`, `frequency-healing/lib/visualization/VisualizationEngine.ts` | Canvas/WebGL shader math | Visual pattern changes when field composition changes. |
| UI field designer | Add layer controls, interference intensity, and motion speed. | 1.5 days | `frequency-healing/components/audio/FrequencyCreator.tsx` | New control panel components | Users can create/edit/save custom field templates. |
| Persistence and tags | Save harmonic-field config in composition payload and discovery tags. | 1 day | `frequency-healing/lib/supabase/types.ts` | JSONB storage + tag update | Discover filters can identify harmonic field sessions. |
| QA and copy review | Validate CPU usage and claim wording. | 0.5 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Perf checks + content review | Claims are framed as experiential, not biomedical proof. |

Estimated total: **9.5 days**

### Integration Strategy

- `FrequencyGenerator`:
  - Add multi-voice field mode with limiter stage.
- Tone.js/audio path:
  - Reuse existing voice stack pattern from `buildFrequencyMix`; add field-specific mix profile.
- Visualization:
  - New `CymaticsRenderer` layer in compositor.
- Supabase:
  - Store config under `innovation_config.harmonicField`.
- New UI:
  - `components/audio/HarmonicFieldPanel.tsx`
  - `components/audio/CymaticsPreview.tsx`

---

## Feature 5 - Breath-Sync Frequency Protocol

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Breath capture + calibration | Add mic setup for breath detection with ambient-noise baseline. | 1.5 days | `frequency-healing/components/audio/FrequencyCreator.tsx`, shared mic service | `getUserMedia`, envelope extraction | Calibration completes in <=20s with confidence output. |
| Breath phase detection | Infer inhale/exhale transitions and BPM trend. | 1.5 days | new `frequency-healing/lib/audio/BreathSyncEngine.ts` | Envelope + zero-crossing/autocorrelation logic | Real-time phase detection latency <500ms on desktop. |
| Coherence guidance logic | Implement nudge-to-5.5 BPM pacing strategy and coherence score. | 1.5 days | `frequency-healing/lib/audio/audioConfig.ts` | Rule-based state machine | Session outputs a reproducible coherence score summary. |
| Audio modulation binding | Tie inhale/exhale phase to gain/filter/tempo envelopes. | 1.5 days | `frequency-healing/lib/audio/FrequencyGenerator.ts` | Tone.js parameter automation | Audible modulation is smooth without pumping artifacts. |
| Breath guide visuals | Add responsive circle/bar guide synced to detected breath phase. | 1.5 days | `frequency-healing/components/audio/WaveformVisualizer.tsx`, `frequency-healing/lib/visualization/VisualizationEngine.ts` | Overlay renderer | Guide stays in sync with audio modulation state. |
| Persistence + reporting | Save breath stats and coherence summary to Supabase. | 1 day | migration + `frequency-healing/lib/supabase/types.ts` | New `breath_sessions` table | Session report visible in profile/history page. |
| QA + fallback behavior | Validate noisy rooms, denied mic, and optional manual mode. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Manual pacing fallback | Feature remains usable without mic permission. |

Estimated total: **9.5 days**

### Integration Strategy

- `FrequencyGenerator`:
  - Add `applyBreathControl(frame)` for real-time envelope control.
- Tone.js/audio path:
  - Reuse existing automation loop and extend with breath-phase modulation.
- Visualization:
  - Add breath guide overlay renderer.
- Supabase:
  - New table `breath_sessions`; optional `breath_samples` for future.
- New UI:
  - `components/audio/BreathSyncPanel.tsx`
  - `components/audio/BreathCoherenceReport.tsx`

---

## Feature 6 - Quantum Intention Imprinting (Experimental)

### WBS

| Task | Description | Est. Effort | Dependencies (existing files) | Technical Requirements | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| Intent input + parser | Accept text/voice intention and extract keywords/themes. | 1 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Lightweight NLP rules (client-side) | Keyword extraction produces stable results for same input. |
| Frequency mapping rules | Map intention themes to frequency presets/modulation signatures. | 1 day | `frequency-healing/lib/audio/mixProfiles.ts`, `frequency-healing/lib/utils/constants.ts` | Rule table + confidence scoring | Mapping is transparent and user-editable before apply. |
| Modulation imprinting | Apply subtle LFO depth/rate patterns to selected tones. | 1 day | `frequency-healing/lib/audio/FrequencyGenerator.ts` | Existing modulation path reuse | Imprint mode toggles cleanly and persists in `audio_config`. |
| Certificate generator | Create shareable "intention mandala" based on hash seed. | 1.5 days | `frequency-healing/lib/visualization/renderers/MandalaRenderer.ts` | Deterministic seed-based visual generation | Same intention + seed reproduces identical certificate. |
| Ethical/disclaimer gate | Add explicit "experimental ritual mode" acknowledgement. | 0.5 day | `frequency-healing/components/ui/Modal.tsx` | Copy + consent persistence | Feature cannot start without consent acknowledgement. |
| QA | Ensure no blocked flows if NLP fails; graceful defaults. | 0.5 day | `frequency-healing/components/audio/FrequencyCreator.tsx` | Fallback mapping | No runtime errors on empty/unsupported input. |

Estimated total: **5.5 days**

### Integration Strategy

- `FrequencyGenerator`:
  - Reuse existing modulation controls (`setAutomation`) with intention presets.
- Tone.js/audio path:
  - No new low-level audio primitives required.
- Visualization:
  - Reuse Mandala renderer with deterministic seed.
- Supabase:
  - New table `intention_imprints` linked to composition.
- New UI:
  - `components/audio/IntentionImprintPanel.tsx`
  - `components/audio/IntentionCertificateCard.tsx`

---

## 4) Cross-Feature Integration Architecture

### 4.1 `FrequencyGenerator` / audio config integration

```ts
// frequency-healing/lib/audio/audioConfig.ts
export interface VoiceBioprintConfig {
  enabled: boolean;
  profileId?: string;
  recommendedFrequencies: number[];
  confidence: number;
}

export interface AdaptiveJourneyConfig {
  enabled: boolean;
  intent: 'sleep' | 'focus' | 'meditate' | 'creative';
  durationMinutes: number;
  steps: Array<{ state: 'delta' | 'theta' | 'alpha' | 'beta' | 'gamma'; beatHz: number; minutes: number }>;
}

export interface BreathSyncConfig {
  enabled: boolean;
  targetBpm: number; // default 5.5
  sensitivity: number;
}

// version bump while preserving old parser fallback
export interface AudioConfigShape {
  version: 2;
  selectedFrequencies: number[];
  frequencyVolumes: Record<string, number>;
  rhythm: RhythmConfig;
  modulation: ModulationConfig;
  sweep: SweepConfig;
  binaural: BinauralConfig;
  voiceBioprint?: VoiceBioprintConfig;
  adaptiveJourney?: AdaptiveJourneyConfig;
  breathSync?: BreathSyncConfig;
}
```

```ts
// frequency-healing/lib/audio/FrequencyGenerator.ts (new hooks)
export interface AdaptiveControlFrame {
  breathPhase?: 'inhale' | 'exhale';
  targetBeatHz?: number;
  modulationDepthScale?: number;
}

setAdaptiveControlFrame(frame: AdaptiveControlFrame) {
  // Called by mic-driven modules.
  // Updates automation targets in bounded ranges to avoid clicks.
}
```

### 4.2 Creator integration pattern

```tsx
// frequency-healing/components/audio/FrequencyCreator.tsx (simplified)
useEffect(() => {
  if (!audioConfig.breathSync?.enabled) return;
  const unsubscribe = breathEngine.onFrame((frame) => {
    generator.setAdaptiveControlFrame({
      breathPhase: frame.phase,
      modulationDepthScale: frame.coherenceScale
    });
  });
  return unsubscribe;
}, [generator, audioConfig.breathSync?.enabled]);
```

### 4.3 Visualization integration

```ts
// frequency-healing/lib/visualization/renderers/CompositorRenderer.ts
// Add new layer types such as:
// - 'room_spectrum'
// - 'cymatics'
// - 'breath_guide'
// and route them in createRenderer(...)
```

### 4.4 Supabase additions (recommended)

```sql
alter table if exists public.compositions
  add column if not exists innovation_config jsonb,
  add column if not exists innovation_flags text[],
  add column if not exists scientific_disclaimer_ack boolean default false;

create table if not exists public.voice_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  profile jsonb not null,
  confidence numeric,
  created_at timestamptz default now()
);

create table if not exists public.room_scans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  mode text not null,
  dominant_frequencies jsonb not null,
  created_at timestamptz default now()
);

create table if not exists public.breath_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  average_bpm numeric,
  coherence_score numeric,
  summary jsonb,
  created_at timestamptz default now()
);

create table if not exists public.intention_imprints (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  composition_id uuid references public.compositions(id) on delete set null,
  intention_text text not null,
  mapping jsonb not null,
  created_at timestamptz default now()
);
```

---

## 5) Permissions and Fallback Plan

| Feature | Permission Needed | If Permission Denied | Optional Hardware |
| --- | --- | --- | --- |
| Voice Bioprint | Microphone (`getUserMedia`) | Use manual "quick profile" questionnaire + preset recommendations | None |
| Sympathetic Resonance Tuner | Microphone (continuous) | Disable live scan; allow manual room tone input (Hz slider) | None |
| Adaptive Binaural | None for base; mic optional for micro-adaptation | Continue with fixed journey timeline | Headphones strongly recommended |
| Solfeggio Harmonic Field | None | N/A | Headphones optional |
| Breath-Sync Protocol | Microphone for passive mode | Switch to guided manual breathing pacer | Optional BLE HR sensor (Phase 3+) |
| Quantum Intention | None | N/A | None |

Bluetooth note:
- Web Bluetooth should be treated as optional Phase 3 enhancement for true HRV devices.
- Always ship a no-hardware fallback (breathing cadence guide) as default.

---

## 6) Prioritization and Phasing

Scoring: 1 (low) to 5 (high).  
For complexity and effort, higher score means harder/more expensive.

| Feature | Scientific Validity | Technical Complexity | User Impact | Dev Effort | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Breath-Sync Protocol | 5 | 4 | 5 | 4 | **Phase 2 (core)** |
| Adaptive Binaural Brain States | 4 | 3 | 4 | 3 | **Phase 2 (core)** |
| Voice Bioprint | 3 | 4 | 5 | 4 | **Phase 2 (MVP scope)** |
| Sympathetic Resonance Tuner | 3 | 5 | 4 | 5 | **Phase 3** |
| Solfeggio Harmonic Field | 2 | 3 | 3 | 3 | **Phase 3** |
| Quantum Intention Imprinting | 1 | 2 | 4 | 2 | **Phase 3 (experimental opt-in)** |

### Rank Order by Criterion

- Scientific validity (strongest to weakest):
1. Breath-Sync
2. Adaptive Binaural
3. Voice Bioprint
4. Sympathetic Resonance Tuner
5. Solfeggio Harmonic Field
6. Quantum Intention Imprinting

- Technical complexity (hardest to easiest):
1. Sympathetic Resonance Tuner
2. Breath-Sync Protocol
3. Voice Bioprint
4. Solfeggio Harmonic Field
5. Adaptive Binaural Brain States
6. Quantum Intention Imprinting

- User impact (highest to lowest):
1. Breath-Sync Protocol
2. Voice Bioprint
3. Adaptive Binaural Brain States
4. Quantum Intention Imprinting
5. Sympathetic Resonance Tuner
6. Solfeggio Harmonic Field

- Development effort (highest to lowest):
1. Sympathetic Resonance Tuner
2. Breath-Sync Protocol
3. Voice Bioprint
4. Solfeggio Harmonic Field
5. Adaptive Binaural Brain States
6. Quantum Intention Imprinting

### Recommended Delivery

- Phase 2:
  - Breath-Sync Protocol (MVP + reporting)
  - Adaptive Binaural Journeys (fixed templates first, mic-adaptation optional)
  - Voice Bioprint Lite (capture + recommendations + portrait)
- Phase 3:
  - Sympathetic Resonance Tuner (Harmonize first, Cleanse as experimental)
  - Solfeggio Harmonic Field (preset-led)
  - Quantum Intention Imprinting (clearly experimental mode)

---

## 7) Simplification Opportunities (MVP vs Full)

| Feature | MVP (recommended) | Full Version (later) | Simplification Note |
| --- | --- | --- | --- |
| Voice Bioprint | Single 5s capture + top-3 frequency suggestions | Multi-sample profile history + adaptive learning | Do not attempt health inference in MVP. |
| Sympathetic Resonance | Harmonize mode only | Add bounded Cleanse mode with calibration | Skip aggressive cancellation claims initially. |
| Adaptive Binaural | 4 static intent journeys | Real-time mic-adaptive journey pacing | Static journeys deliver most user value with less risk. |
| Solfeggio Field | Curated preset stacks | User-programmable field matrix + spatial choreography | Presets reduce complexity and onboarding friction. |
| Breath-Sync | Guided pacer + optional mic sync + coherence score | Add BLE HRV integration and advanced adaptive loops | Mic-free flow keeps adoption high. |
| Quantum Intention | Text-to-preset mapping + share card | Voice intent, semantic embeddings, deeper modulation grammar | Keep as creative ritual mode, not scientific claim. |

Features to explicitly flag as scientifically questionable:
- Quantum Intention Imprinting (core claim).
- Emoto-derived intention-to-matter framing.
- Strong therapeutic claims around Solfeggio/528 DNA repair.

---

## 8) Estimated Timeline (single full-stack engineer baseline)

- Shared foundation: 4.5 days
- Phase 2 feature set (Breath-Sync + Adaptive Binaural + Voice Bioprint Lite): 24.5 days
- Phase 3 feature set (Sympathetic + Solfeggio + Quantum): 25 days
- Integration, QA hardening, and content review buffer: 6-8 days

Total projected implementation window: **~60-62 engineering days** (including QA and iteration), or ~12-13 weeks at 5 days/week.

---

## 9) Research References

Tomatis / auditory therapies:
- [Cochrane review: Auditory integration training and other sound therapies for autism spectrum disorders](https://pubmed.ncbi.nlm.nih.gov/22161380/)
- [Brief report: effects of Tomatis sound therapy on language in children with autism](https://pubmed.ncbi.nlm.nih.gov/17610057/)

Voice analysis / biomarkers:
- [Voice-based AI in medicine: a systematic review and meta-analysis](https://www.sciencedirect.com/science/article/pii/S2666389924002504)
- [Voice as a biomarker for disease detection and monitoring](https://pubmed.ncbi.nlm.nih.gov/39442790/)

Sympathetic resonance / active noise control / soundscapes:
- [Active noise control: a tutorial review](https://www.researchgate.net/publication/2985088_Active_Noise_Control_A_Tutorial_Review)
- [Active noise control in a ventilation duct using a fixed-coefficient adaptive algorithm](https://pubmed.ncbi.nlm.nih.gov/25480024/)
- [A synthesis of health benefits of natural sounds and their distribution in national parks](https://pubmed.ncbi.nlm.nih.gov/33875595/)

Brainwave entrainment / binaural beats:
- [Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis](https://pubmed.ncbi.nlm.nih.gov/30470961/)
- [Brainwave entrainment for better health: systematic review](https://pubmed.ncbi.nlm.nih.gov/26669218/)
- [Effects of binaural beat music and noise-cancelling earphones on preoperative anxiety](https://pubmed.ncbi.nlm.nih.gov/26737795/)

Coherent breathing / HRV:
- [How breath-control can change your life: a systematic review on psychophysiological correlates of slow breathing](https://pubmed.ncbi.nlm.nih.gov/30029636/)
- [Resonance frequency breathing and vagal activation](https://pubmed.ncbi.nlm.nih.gov/32187356/)
- [Effects of resonance breathing on stress and cognitive function in office workers](https://pubmed.ncbi.nlm.nih.gov/39862133/)

Solfeggio / tuning evidence:
- [Experimental study of music tuned to 440 Hz versus 432 Hz](https://pubmed.ncbi.nlm.nih.gov/31031095/)
- [Pilot crossover study: music tuned to 432 Hz vs 440 Hz before dental extraction](https://pubmed.ncbi.nlm.nih.gov/33263352/)
- [Influence of 528 Hz sound-wave intensity on endocrine and anxiety-like behavior in rats](https://pubmed.ncbi.nlm.nih.gov/30414050/)

Emoto/water claims and cymatics context:
- [Double-blind test of the effects of distant intention on water crystal formation](https://pubmed.ncbi.nlm.nih.gov/16979104/)
- [High-dilution / water-memory controversy discussion in Nature](https://pubmed.ncbi.nlm.nih.gov/24552367/)
- [Cymatics and pattern formation in complex systems (context review)](https://www.mdpi.com/2073-8994/14/4/708)

