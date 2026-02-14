// ============================================================
// INNER SELF — Type Definitions
// ============================================================

// --- Raw Entry (Immutable Source of Truth) ---
export interface RawEntry {
  id: string;
  created_at: string;
  raw_text: string;
  audio_url: string | null;
  audio_duration_sec: number | null;
  source: 'text' | 'voice' | 'image';
  input_metadata: InputMetadata | null;
  deleted_at: string | null;
}

export interface InputMetadata {
  device?: string;
  time_of_day?: string;
  entry_length_chars?: number;
}

// --- Extracted Entity (AI Analysis) ---
export interface ExtractedEntity {
  id: string;
  entry_id: string;
  category: EntryCategory;
  title: string;
  content: string;
  mood_score: number;
  surface_emotion: string;
  deeper_emotion: string;
  core_need: string;
  triggers: string[];
  defense_mechanism: string | null;
  self_talk_tone: 'critical' | 'neutral' | 'compassionate';
  energy_level: number;
  cognitive_pattern: string | null;
  beliefs_revealed: string[];
  avoidance_signal: string | null;
  growth_edge: string | null;
  identity_persona: IdentityPersona;
  body_signals: string[];
  is_task: boolean;
  task_status: 'pending' | 'done' | 'cancelled' | null;
  task_due_date: string | null;
  people_mentioned: PersonMention[];
  ai_response: string;
  ai_persona_used: AIPersona;
  follow_up_question: string | null;
}

export type EntryCategory =
  | 'emotion'
  | 'task'
  | 'reflection'
  | 'goal'
  | 'memory'
  | 'idea'
  | 'gratitude'
  | 'vent';

export type IdentityPersona =
  | 'Professional'
  | 'Son'
  | 'Builder'
  | 'Seeker'
  | 'Achiever'
  | 'Wounded'
  | 'Friend';

// --- People Map ---
export interface PersonMap {
  id: string;
  name: string;
  relationship: string;
  first_mentioned: string;
  last_mentioned: string;
  mention_count: number;
  sentiment_history: SentimentEntry[];
  sentiment_avg: number;
  notes: string | null;
  tags: string[];
}

export interface SentimentEntry {
  date: string;
  sentiment: number;
  context: string;
}

export interface PersonMention {
  name: string;
  relationship: string;
  sentiment: string;
  context: string;
}

// --- Life Events ---
export interface LifeEvent {
  id: string;
  event_date: string;
  title: string;
  description: string;
  significance: number;
  chapter: string;
  category: string;
  emotions: string[];
  people_involved: string[];
  source_entry_ids: string[];
}

// --- User Persona Summary ---
export interface UserPersonaSummary {
  id: string;
  updated_at: string;
  life_chapter_title: string;
  life_chapter_narrative: string;
  baseline_mood: string;
  baseline_energy: number;
  active_goals: ActiveGoal[];
  dominant_personas: string[];
  neglected_personas: string[];
  key_relationships: Record<string, RelationshipStatus>;
  core_beliefs_operating: string[];
  biggest_growth_edge: string;
  currently_avoiding: string;
  self_talk_ratio: SelfTalkRatio;
  recurring_patterns: string[];
  companion_preference: string;
  full_psychological_profile: string;
}

export interface ActiveGoal {
  goal: string;
  status: string;
  first_mentioned: string;
  last_mentioned: string;
}

export interface RelationshipStatus {
  status: string;
  sentiment: number;
  last_update: string;
}

export interface SelfTalkRatio {
  positive: number;
  neutral: number;
  critical: number;
}

// --- Embeddings ---
export interface Embedding {
  id: string;
  entry_id: string;
  embedding: number[];
  content_text: string;
  metadata: EmbeddingMetadata;
}

export interface EmbeddingMetadata {
  category: string;
  mood: number;
  date: string;
  people: string[];
  persona: string;
}

// --- Conversations ---
export interface Conversation {
  id: string;
  created_at: string;
  role: 'user' | 'assistant';
  content: string;
  context_entry_ids: string[];
  persona_used: AIPersona | null;
}

// --- Insights ---
export interface Insight {
  id: string;
  created_at: string;
  insight_text: string;
  type: string;
  source_entry_id: string;
}

// --- Weekly Reports ---
export interface WeeklyReport {
  id: string;
  created_at: string;
  week_start: string;
  week_end: string;
  mood_avg: number;
  energy_avg: number;
  wins: string[];
  struggles: string[];
  honest_truth: string;
  growth_observed: string;
  recommendation: string;
  entry_count: number;
}

// --- Void Tracker ---
export interface VoidTracker {
  id: string;
  tag_name: string;
  last_mentioned: string;
  peak_frequency: number;
  current_frequency: number;
  decay_percentage: number;
  status: 'active' | 'fading' | 'void';
  surfaced_at: string | null;
}

// --- Deepening Questions ---
export interface DeepeningQuestion {
  id: string;
  question_text: string;
  category: string;
  week_range: string;
  asked_at: string | null;
  answered_at: string | null;
  answer: string | null;
  skipped: boolean;
}

// --- Onboarding ---
export interface OnboardingAnswer {
  id: string;
  question_number: number;
  question_text: string;
  answer_text: string;
  answered_at: string;
}

// --- Letters To Future ---
export interface LetterToFuture {
  id: string;
  created_at: string;
  content: string;
  unlock_date: string;
  context_when_written: string;
  unlocked: boolean;
}

// --- AI Personas ---
export type AIPersona =
  | 'mother'
  | 'father'
  | 'friend'
  | 'guru'
  | 'coach'
  | 'psychologist'
  | 'partner'
  | 'mirror'
  | 'daughter'
  | 'brother'
  | 'manager';

// --- Self Talk Daily ---
export interface SelfTalkDaily {
  id: string;
  date: string;
  positive_pct: number;
  neutral_pct: number;
  critical_pct: number;
  entry_count: number;
}

// --- Temporal Markers ---
export interface TemporalMarker {
  id: string;
  event_title: string;
  event_date: string;
  recurrence: 'annual' | 'one-time';
  reminder_message: string | null;
  last_checked: string | null;
}

// --- Belief System ---
export interface BeliefSystem {
  id: string;
  belief_text: string;
  domain: string;
  first_surfaced: string;
  last_reinforced: string;
  reinforcement_count: number;
  status: 'active' | 'questioned' | 'evolved';
}

// --- Courage Log ---
export interface CourageLog {
  id: string;
  event_description: string;
  date: string;
  context: string;
  source_entry_id: string;
}

// --- Dreams ---
export interface Dream {
  id: string;
  created_at: string;
  raw_text: string;
  symbols: string[];
  waking_connections: string | null;
  source_entry_id: string;
}

// --- Extraction Result from Claude ---
export interface ExtractionResult {
  category: EntryCategory;
  title: string;
  content: string;
  mood_score: number;
  surface_emotion: string;
  deeper_emotion: string;
  core_need: string;
  triggers: string[];
  defense_mechanism: string | null;
  self_talk_tone: 'critical' | 'neutral' | 'compassionate';
  energy_level: number;
  cognitive_pattern: string | null;
  beliefs_revealed: string[];
  avoidance_signal: string | null;
  growth_edge: string | null;
  identity_persona: IdentityPersona;
  body_signals: string[];
  is_task: boolean;
  task_status: 'pending' | 'done' | 'cancelled' | null;
  task_due_date: string | null;
  people_mentioned: PersonMention[];
  ai_persona_selected: AIPersona;
  ai_response: string;
  follow_up_question: string | null;
  life_event_detected: {
    title: string;
    description: string;
    significance: number;
    category: string;
    emotions: string[];
    people_involved: string[];
  } | null;
  insights: string[];
}

// --- App State ---
export type TabName = 'dump' | 'log' | 'tasks' | 'life' | 'mirror' | 'chat';

export interface AppState {
  activeTab: TabName;
  isRecording: boolean;
  isProcessing: boolean;
  onboardingComplete: boolean;
}
