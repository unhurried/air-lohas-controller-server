import { DurableObject } from "cloudflare:workers";
import type {
  AirconSettings,
  CurrentAirconSettings,
  AirconReservation,
  AirconState,
} from "./aircon-types";
import {
  DEFAULT_CURRENT_SETTINGS,
  normalizeSettings,
  normalizeReservation,
  normalizeState,
} from "./aircon-normalize";
import { applyDueReservation, type CronApplication } from "./aircon-cron";

// 共有定数は cloudflare:workers 非依存の aircon-types.ts で定義し、ここで再エクスポートする。
export { AC_STATE_SINGLETON } from "./aircon-types";

type CurrentSettingsRow = {
  mode: string;
  base_temperature: number;
  room_offsets: string;
  updated_at: string;
};

type ReservationRow = {
  id: string;
  time: string;
  enabled: number;
  settings: string;
  last_applied_date: string | null;
};

/**
 * SQLite-backed Durable Object。エアコン状態（現在設定 + 予約）を永続化する。
 * KV の単一 JSON ブロブを、current_settings（1 行）と reservations（行ごと）の
 * 正規化テーブルに置き換えたもの。
 *
 * 状態の正規化（normalize*）と Cron の予約適用ロジック（applyDueReservation）は
 * src/lib の純粋関数を再利用し、この DO は SQL の読み書きとアトミックな
 * read-modify-write のみを担う。
 */
export class AirconStateDO extends DurableObject {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS current_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL,
        base_temperature INTEGER NOT NULL,
        room_offsets TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        settings TEXT NOT NULL,
        last_applied_date TEXT
      );
    `);
  }

  private readCurrentSettings(): CurrentAirconSettings {
    const rows = this.sql
      .exec<CurrentSettingsRow>("SELECT * FROM current_settings WHERE id = 1")
      .toArray();

    if (rows.length === 0) {
      return structuredClone(DEFAULT_CURRENT_SETTINGS);
    }

    const row = rows[0];
    return {
      mode: row.mode as AirconSettings["mode"],
      baseTemperature: row.base_temperature,
      roomOffsets: JSON.parse(row.room_offsets),
      updatedAt: row.updated_at,
    };
  }

  private readReservations(): AirconReservation[] {
    const rows = this.sql
      .exec<ReservationRow>("SELECT * FROM reservations ORDER BY time ASC")
      .toArray();

    return rows.map((row) => ({
      id: row.id,
      time: row.time,
      enabled: row.enabled !== 0,
      settings: JSON.parse(row.settings) as AirconSettings,
      lastAppliedDate: row.last_applied_date ?? undefined,
    }));
  }

  private writeCurrentSettings(settings: CurrentAirconSettings): void {
    this.sql.exec(
      `INSERT INTO current_settings (id, mode, base_temperature, room_offsets, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         mode = excluded.mode,
         base_temperature = excluded.base_temperature,
         room_offsets = excluded.room_offsets,
         updated_at = excluded.updated_at`,
      settings.mode,
      settings.baseTemperature,
      JSON.stringify(settings.roomOffsets),
      settings.updatedAt,
    );
  }

  private writeReservations(reservations: AirconReservation[]): void {
    this.sql.exec("DELETE FROM reservations");
    for (const reservation of reservations) {
      this.sql.exec(
        `INSERT INTO reservations (id, time, enabled, settings, last_applied_date)
         VALUES (?, ?, ?, ?, ?)`,
        reservation.id,
        reservation.time,
        reservation.enabled ? 1 : 0,
        JSON.stringify(reservation.settings),
        reservation.lastAppliedDate ?? null,
      );
    }
  }

  /** 現在の状態全体を取得する。 */
  getState(): AirconState {
    return normalizeState({
      currentSettings: this.readCurrentSettings(),
      reservations: this.readReservations(),
    });
  }

  /** 現在設定を保存する（updatedAt を現在時刻で更新）。予約はそのまま。 */
  saveSettings(nextSettings: AirconSettings): void {
    const normalized = normalizeSettings(nextSettings);
    this.writeCurrentSettings({
      ...normalized,
      updatedAt: new Date().toISOString(),
    });
    this.broadcastStateChanged();
  }

  /** 予約一覧を全置換で保存する。現在設定はそのまま。 */
  saveReservations(nextReservations: AirconReservation[]): void {
    const normalized = nextReservations
      .map((reservation) => normalizeReservation(reservation))
      .filter((reservation): reservation is AirconReservation => reservation !== null);
    this.writeReservations(normalized);
    this.broadcastStateChanged();
  }

  /**
   * Cron から呼ばれる。該当予約があれば現在設定へ適用し、対象予約の
   * last_applied_date を更新する。単一 RPC 内で read-modify-write するため、
   * ユーザーの設定変更と競合してもアトミックに処理される。
   */
  applyDueReservations(nowISO: string): CronApplication | null {
    const state = this.getState();
    const result = applyDueReservation(state, new Date(nowISO));

    if (!result) {
      return null;
    }

    this.writeCurrentSettings(result.nextState.currentSettings);
    this.writeReservations(result.nextState.reservations);
    this.broadcastStateChanged();

    return result;
  }

  /**
   * WebSocket アップグレードのみを扱う fetch ハンドラ。フォームの即時更新用に、
   * 状態変更のたびに接続中の全クライアントへ通知を送る（Hibernation API）。
   * 実際の状態は通知を受けたクライアントが getState() 相当（RSC の再取得）で
   * 取りに行くため、ここでは変更があった事実だけを送る。
   */
  fetch(request: Request): Response {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(): Promise<void> {
    // クライアント→サーバのメッセージは扱わない（状態変更通知の一方向配信のみ）。
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    // 予約済みの終了コードは切断イベントで通知されても、フレームとして送信できない。
    const closeCode = [1004, 1005, 1006, 1015].includes(code) ? 1000 : code;
    ws.close(closeCode, reason);
  }

  async webSocketError(): Promise<void> {
    // 個別ソケットのエラーは無視する。切断は webSocketClose 側で処理される。
  }

  private broadcastStateChanged(): void {
    const payload = JSON.stringify({ type: "state-changed" });
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // 送信に失敗したソケットは無視する（クローズは別途ハンドリングされる）。
      }
    }
  }
}
