export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      compositions: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          description: string | null;
          frequencies: number[];
          frequency_volumes: Json | null;
          duration: number | null;
          waveform: string | null;
          ambient_sound: string | null;
          effects: Json | null;
          audio_config: Json | null;
          innovation_config: Json | null;
          innovation_flags: string[] | null;
          scientific_disclaimer_ack: boolean | null;
          voice_profile_id: string | null;
          visualization_type: string | null;
          visualization_config: Json | null;
          visualization_layers: Json | null;
          audio_url: string | null;
          video_url: string | null;
          thumbnail_url: string | null;
          is_public: boolean | null;
          play_count: number | null;
          like_count: number | null;
          tags: string[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          description?: string | null;
          frequencies: number[];
          frequency_volumes?: Json | null;
          duration?: number | null;
          waveform?: string | null;
          ambient_sound?: string | null;
          effects?: Json | null;
          audio_config?: Json | null;
          innovation_config?: Json | null;
          innovation_flags?: string[] | null;
          scientific_disclaimer_ack?: boolean | null;
          voice_profile_id?: string | null;
          visualization_type?: string | null;
          visualization_config?: Json | null;
          visualization_layers?: Json | null;
          audio_url?: string | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          is_public?: boolean | null;
          play_count?: number | null;
          like_count?: number | null;
          tags?: string[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          frequencies?: number[];
          frequency_volumes?: Json | null;
          duration?: number | null;
          waveform?: string | null;
          ambient_sound?: string | null;
          effects?: Json | null;
          audio_config?: Json | null;
          innovation_config?: Json | null;
          innovation_flags?: string[] | null;
          scientific_disclaimer_ack?: boolean | null;
          voice_profile_id?: string | null;
          visualization_type?: string | null;
          visualization_config?: Json | null;
          visualization_layers?: Json | null;
          audio_url?: string | null;
          video_url?: string | null;
          thumbnail_url?: string | null;
          is_public?: boolean | null;
          play_count?: number | null;
          like_count?: number | null;
          tags?: string[] | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      composition_likes: {
        Row: {
          id: string;
          composition_id: string | null;
          user_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          composition_id?: string | null;
          user_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          composition_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          composition_id: string | null;
          user_id: string | null;
          content: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          composition_id?: string | null;
          user_id?: string | null;
          content: string;
          created_at?: string | null;
        };
        Update: {
          content?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string | null;
          is_public: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          description?: string | null;
          is_public?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_public?: boolean | null;
        };
        Relationships: [];
      };
      collection_items: {
        Row: {
          collection_id: string;
          composition_id: string;
          added_at: string | null;
        };
        Insert: {
          collection_id: string;
          composition_id: string;
          added_at?: string | null;
        };
        Update: {
          collection_id?: string;
          composition_id?: string;
          added_at?: string | null;
        };
        Relationships: [];
      };
      voice_profiles: {
        Row: {
          id: string;
          user_id: string;
          profile: Json;
          confidence: number | null;
          capture_duration_ms: number | null;
          analysis_duration_ms: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          profile: Json;
          confidence?: number | null;
          capture_duration_ms?: number | null;
          analysis_duration_ms?: number | null;
          created_at?: string | null;
        };
        Update: {
          profile?: Json;
          confidence?: number | null;
          capture_duration_ms?: number | null;
          analysis_duration_ms?: number | null;
        };
        Relationships: [];
      };
      room_scans: {
        Row: {
          id: string;
          user_id: string;
          composition_id: string | null;
          mode: string;
          dominant_frequencies: Json;
          spectrum: Json | null;
          confidence: number | null;
          noise_floor_db: number | null;
          peak_db: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          composition_id?: string | null;
          mode: string;
          dominant_frequencies: Json;
          spectrum?: Json | null;
          confidence?: number | null;
          noise_floor_db?: number | null;
          peak_db?: number | null;
          created_at?: string | null;
        };
        Update: {
          composition_id?: string | null;
          mode?: string;
          dominant_frequencies?: Json;
          spectrum?: Json | null;
          confidence?: number | null;
          noise_floor_db?: number | null;
          peak_db?: number | null;
        };
        Relationships: [];
      };
      journey_sessions: {
        Row: {
          id: string;
          user_id: string;
          composition_id: string | null;
          intent: string;
          current_state: string | null;
          progress: number | null;
          last_beat_hz: number | null;
          last_breath_bpm: number | null;
          adaptive_offset_hz: number | null;
          duration_minutes: number | null;
          mic_adaptation_enabled: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          composition_id?: string | null;
          intent: string;
          current_state?: string | null;
          progress?: number | null;
          last_beat_hz?: number | null;
          last_breath_bpm?: number | null;
          adaptive_offset_hz?: number | null;
          duration_minutes?: number | null;
          mic_adaptation_enabled?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          composition_id?: string | null;
          intent?: string;
          current_state?: string | null;
          progress?: number | null;
          last_beat_hz?: number | null;
          last_breath_bpm?: number | null;
          adaptive_offset_hz?: number | null;
          duration_minutes?: number | null;
          mic_adaptation_enabled?: boolean | null;
        };
        Relationships: [];
      };
      harmonic_field_sessions: {
        Row: {
          id: string;
          user_id: string;
          composition_id: string | null;
          preset_id: string;
          layer_frequencies: Json;
          interference_frequencies: Json | null;
          intensity: number | null;
          include_interference: boolean | null;
          spatial_motion_enabled: boolean | null;
          motion_speed: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          composition_id?: string | null;
          preset_id: string;
          layer_frequencies: Json;
          interference_frequencies?: Json | null;
          intensity?: number | null;
          include_interference?: boolean | null;
          spatial_motion_enabled?: boolean | null;
          motion_speed?: number | null;
          created_at?: string | null;
        };
        Update: {
          composition_id?: string | null;
          preset_id?: string;
          layer_frequencies?: Json;
          interference_frequencies?: Json | null;
          intensity?: number | null;
          include_interference?: boolean | null;
          spatial_motion_enabled?: boolean | null;
          motion_speed?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      increment_play_count: {
        Args: {
          composition_id: string;
        };
        Returns: number | null;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}
