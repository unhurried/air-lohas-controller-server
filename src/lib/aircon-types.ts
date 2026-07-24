/**
 * Durable Object の単一インスタンス名。アプリ側（aircon-settings.ts）と
 * Cron（worker.mjs）の双方が同じ id を参照するために共有する。
 * cloudflare:workers に依存しない純粋モジュールに置くことで、DO クラス本体を
 * 読み込めない環境（Vitest / next dev）からも安全に import できる。
 */
export const AC_STATE_SINGLETON = "singleton";

export const ROOM_NAMES = [
  "リビング",
  "寝室",
  "書斎",
  "玄関",
  "洗面室",
  "子供部屋1",
  "子供部屋2",
  "ホール2",
] as const;

export type RoomName = (typeof ROOM_NAMES)[number];

export type AirconMode = "-" | "auto-save" | "heat" | "cool";

export type AirconSettings = {
  mode: AirconMode;
  baseTemperature: number;
  roomOffsets: Record<RoomName, number>;
};

export type CurrentAirconSettings = AirconSettings & {
  updatedAt: string;
};

export type AirconReservation = {
  id: string;
  time: string;
  enabled: boolean;
  settings: AirconSettings;
  lastAppliedDate?: string;
};

export type AirconState = {
  currentSettings: CurrentAirconSettings;
  reservations: AirconReservation[];
};
