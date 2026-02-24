"use client";

import { useEffect, useState, useTransition } from "react";
import {
  clampOffset,
  clampTemperature,
  ROOM_NAMES,
  type AirconReservation,
  type AirconSettings,
  type RoomName,
} from "@/lib/aircon-settings";
import { ModeButtonGroup } from "@/components/aircon/mode-button-group";
import { BaseTemperatureStepper } from "@/components/aircon/base-temperature-stepper";
import { RoomOffsetGrid } from "@/components/aircon/room-offset-grid";

type ReservationsFormProps = {
  initialDraftSettings: AirconSettings;
  initialReservations: AirconReservation[];
  addReservation: (formData: FormData) => Promise<void>;
  toggleReservation: (formData: FormData) => Promise<void>;
  deleteReservation: (formData: FormData) => Promise<void>;
};

function toReservationFormData(settings: AirconSettings, reservationTime: string): FormData {
  const formData = new FormData();
  formData.set("reservationTime", reservationTime);
  formData.set("mode", settings.mode);
  formData.set("baseTemperature", String(settings.baseTemperature));

  ROOM_NAMES.forEach((room) => {
    formData.set(`room-${room}`, String(settings.roomOffsets[room]));
  });

  return formData;
}

export function ReservationsForm({
  initialDraftSettings,
  initialReservations,
  addReservation,
  toggleReservation,
  deleteReservation,
}: ReservationsFormProps) {
  const [draftSettings, setDraftSettings] = useState(initialDraftSettings);
  const [reservationTime, setReservationTime] = useState("07:00");
  const [reservations, setReservations] = useState(initialReservations);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDraftSettings(initialDraftSettings);
  }, [initialDraftSettings]);

  useEffect(() => {
    setReservations(initialReservations);
  }, [initialReservations]);

  const updateMode = (mode: AirconSettings["mode"]) => {
    setDraftSettings((previous) => ({ ...previous, mode }));
  };

  const updateBaseTemperature = (baseTemperature: number) => {
    setDraftSettings((previous) => ({
      ...previous,
      baseTemperature: clampTemperature(baseTemperature),
    }));
  };

  const updateRoomOffset = (room: RoomName, offset: number) => {
    setDraftSettings((previous) => ({
      ...previous,
      roomOffsets: {
        ...previous.roomOffsets,
        [room]: clampOffset(offset),
      },
    }));
  };

  const createReservation = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reservationTime)) {
      return;
    }

    const optimisticReservation: AirconReservation = {
      id: `local-${Date.now()}`,
      time: reservationTime,
      enabled: true,
      settings: draftSettings,
    };

    setReservations((previous) =>
      [...previous, optimisticReservation].sort((a, b) => a.time.localeCompare(b.time)),
    );

    startTransition(() => {
      void addReservation(toReservationFormData(draftSettings, reservationTime));
    });
  };

  const setReservationEnabled = (reservationId: string, enabled: boolean) => {
    setReservations((previous) =>
      previous.map((reservation) =>
        reservation.id === reservationId ? { ...reservation, enabled } : reservation,
      ),
    );

    const formData = new FormData();
    formData.set("reservationId", reservationId);
    formData.set("enabled", String(enabled));

    startTransition(() => {
      void toggleReservation(formData);
    });
  };

  const removeReservation = (reservationId: string) => {
    setReservations((previous) =>
      previous.filter((reservation) => reservation.id !== reservationId),
    );

    const formData = new FormData();
    formData.set("reservationId", reservationId);

    startTransition(() => {
      void deleteReservation(formData);
    });
  };

  return (
    <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <ModeButtonGroup
          label="予約時の動作モード"
          ariaLabel="予約時の動作モード"
          value={draftSettings.mode}
          onChange={updateMode}
        />

        <BaseTemperatureStepper
          label="予約時の基準温度"
          value={draftSettings.baseTemperature}
          min={18}
          max={25}
          onChange={updateBaseTemperature}
        />
      </div>

      <RoomOffsetGrid
        title="予約時の各部屋温度補正（基準温度比）"
        offsets={draftSettings.roomOffsets}
        onChange={updateRoomOffset}
      />

      <div className="space-y-2.5 border-t border-zinc-200 pt-3 sm:space-y-3 sm:pt-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">予約一覧</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1">
            <span className="text-sm">時刻</span>
            <input
              type="time"
              step={60}
              value={reservationTime}
              onChange={(event) => setReservationTime(event.target.value)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </label>
          <button
            type="button"
            onClick={createReservation}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            この設定で予約追加
          </button>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {reservations.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">予約はありません。</p>
          )}

          {[...reservations]
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-md border border-zinc-200 p-2.5 text-sm sm:p-3 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{reservation.time}</div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={reservation.enabled}
                        onChange={(event) =>
                          setReservationEnabled(reservation.id, event.target.checked)
                        }
                      />
                      有効
                    </label>
                    <button
                      type="button"
                      onClick={() => removeReservation(reservation.id)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-zinc-600 sm:mt-2 dark:text-zinc-300">
                  {reservation.settings.mode === "auto-save" ? "自動セーブ" : "自動定常"}
                  {" / "}
                  基準 {reservation.settings.baseTemperature}℃
                </p>
                <div className="mt-1.5 grid gap-0.5 sm:mt-2 sm:gap-1 sm:grid-cols-2">
                  {ROOM_NAMES.map((room) => {
                    const offset = reservation.settings.roomOffsets[room];
                    const roomTemperature = reservation.settings.baseTemperature + offset;

                    return (
                      <p
                        key={`${reservation.id}-${room}`}
                        className="text-xs text-zinc-600 dark:text-zinc-300"
                      >
                        {room}: {roomTemperature}℃ ({offset > 0 ? `+${offset}` : offset})
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isPending ? "保存中..." : "予約は現在設定と独立して管理されます"}
      </p>
    </div>
  );
}
