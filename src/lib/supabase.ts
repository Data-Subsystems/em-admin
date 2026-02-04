import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Client-side client with anon key
export const createBrowserClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

// Types for database tables
export interface ScoreboardModel {
  id: string;
  model_name: string;
  image_filename: string;
  image_url?: string;
  sport_type?: string;
  dimensions?: string;
  layout_type?: string;
  zones?: Zone[];
  customizable_areas?: CustomizableArea[];
  features?: string[];
  analysis_raw?: Record<string, unknown>;
  analysis_status: "pending" | "processing" | "completed" | "error";
  analysis_error?: string;
  color_config?: ColorConfig;
  created_at: string;
  updated_at: string;
  analyzed_at?: string;
}

export interface Zone {
  zone_id: string;
  zone_type:
    | "score_display"
    | "clock_display"
    | "text_label"
    | "indicator_lights"
    | "period_display"
    | "penalty_display"
    | "count_display"
    | "logo_area";
  label?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  digit_count?: number;
  has_colon?: boolean;
}

export interface CustomizableArea {
  area_id: string;
  area_type: "face" | "accent_stripe" | "led_display" | "text";
  current_color_hint?: string;
}

export interface ColorConfig {
  "scoreboard-face": Record<string, string>;
  "accent-striping": Record<string, string>;
  "led-color": Record<string, string> | "none";
}

export interface AnalysisJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total_images: number;
  processed_images: number;
  error_count: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CustomConfiguration {
  id: string;
  name: string;
  base_model_id?: string;
  face_color?: string;
  accent_color?: string;
  led_color?: string;
  face_color_rgb?: string;
  accent_color_rgb?: string;
  led_color_rgb?: string;
  custom_labels?: Record<string, string>;
  preview_image_url?: string;
  created_at: string;
  updated_at: string;
}

// Color palette (shared across all models)
export const COLOR_PALETTE: Record<string, string> = {
  navy_blue: "rgb(16,43,78)",
  egyptian_blue: "rgb(35,60,136)",
  royal_blue: "rgb(36,98,167)",
  icy_blue: "rgb(117,190,233)",
  shamrock_green: "rgb(0,159,72)",
  jolly_green: "rgb(0,114,59)",
  hunter_green: "rgb(14,69,42)",
  silver_gray: "rgb(201,199,199)",
  matte_black: "rgb(45,42,43)",
  indigo_purple: "rgb(94,46,134)",
  power_purple: "rgb(104,28,91)",
  merchant_maroon: "rgb(116,17,46)",
  cardinal_red: "rgb(182,31,61)",
  racing_red: "rgb(227,50,38)",
  tiger_orange: "rgb(244,121,32)",
  golden_yellow: "rgb(255,212,0)",
  metallic_gold: "rgb(180,151,90)",
  white: "rgb(255,255,255)",
};

export const LED_COLORS: Record<string, string> = {
  red: "rgb(236,27,36)",
  amber: "rgb(249,165,25)",
};
