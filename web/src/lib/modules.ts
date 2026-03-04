import {
  Mic,
  Shield,
  UserPlus,
  TrendingUp,
  Music2,
  FileText,
  type LucideIcon,
} from "lucide-react";
import type { Plan } from "@nocta/database";

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Minimum plan required to enable this module. */
  requiredPlan: Plan;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: "voice",
    name: "Voice Assistant",
    description: 'Wake word detection, voice queries, and AI-powered spoken responses via "Nocta".',
    icon: Mic,
    requiredPlan: "FREE",
  },
  {
    id: "moderation",
    name: "Auto-Moderation",
    description: "Warning system, mutes, kicks, and ban tracking with full infraction history.",
    icon: Shield,
    requiredPlan: "FREE",
  },
  {
    id: "welcome",
    name: "Welcome Messages",
    description: "Greet new members with customisable embedded messages in a chosen channel.",
    icon: UserPlus,
    requiredPlan: "FREE",
  },
  {
    id: "leveling",
    name: "Leveling & XP",
    description: "Gamify activity with XP, levels, leaderboards, and role rewards.",
    icon: TrendingUp,
    requiredPlan: "PRO",
  },
  {
    id: "music",
    name: "Music Player",
    description: "High-quality music playback from YouTube, Spotify, and SoundCloud.",
    icon: Music2,
    requiredPlan: "PRO",
  },
  {
    id: "logging",
    name: "Event Logging",
    description: "Detailed audit logs for message edits, deletions, member joins, and more.",
    icon: FileText,
    requiredPlan: "PRO",
  },
];

const PLAN_RANK: Record<Plan, number> = { FREE: 0, PRO: 1, PREMIUM: 2 };

/** Returns true if `userPlan` satisfies the module's minimum plan requirement. */
export function canEnableModule(module: ModuleDefinition, userPlan: Plan): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[module.requiredPlan];
}
