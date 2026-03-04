// ─── Guild ────────────────────────────────────────────────────────────────────

export interface Guild {
  id: string;
  discordId: string;
  name: string;
  iconUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildSettings {
  guildId: string;
  prefix: string;
  language: string;
  logChannelId: string | null;
  welcomeChannelId: string | null;
  welcomeMessage: string | null;
  modRoleId: string | null;
  adminRoleId: string | null;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = "USER" | "MOD" | "ADMIN" | "OWNER";

export interface GuildMember {
  userId: string;
  guildId: string;
  role: UserRole;
  joinedAt: Date;
  xp: number;
  level: number;
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export type InfractionType = "WARN" | "MUTE" | "KICK" | "BAN" | "UNBAN" | "UNMUTE";

export interface Infraction {
  id: string;
  guildId: string;
  targetUserId: string;
  moderatorUserId: string;
  type: InfractionType;
  reason: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// ─── Logging ──────────────────────────────────────────────────────────────────

export type LogEventType =
  | "MESSAGE_DELETE"
  | "MESSAGE_EDIT"
  | "MEMBER_JOIN"
  | "MEMBER_LEAVE"
  | "MEMBER_BAN"
  | "MEMBER_UNBAN"
  | "ROLE_ADD"
  | "ROLE_REMOVE"
  | "CHANNEL_CREATE"
  | "CHANNEL_DELETE";

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  ok: true;
}

export interface ApiError {
  error: string;
  code: string;
  ok: false;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
