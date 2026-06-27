"use client";

import { useState, useTransition } from "react";
import {
  ROOM_NAMES,
  type AirconReservation,
  type AirconSettings,
  type RoomName,
} from "@/lib/aircon-types";
import { clampOffset, clampTemperature } from "@/lib/aircon-settings";
import { getModeLabel } from "@/lib/aircon-mode";
import { ModeButtonGroup } from "@/components/aircon/mode-button-group";
import { BaseTemperatureStepper } from "@/components/aircon/base-temperature-stepper";
import { RoomOffsetGrid } from "@/components/aircon/room-offset-grid";

type ReservationsFormProps = {
  currentSettings: AirconSettings;
  initialReservations: AirconReservation[];
  addReservation: (formData: FormData) => Promise<void>;
  updateReservation: (formData: FormData) => Promise<void>;
  toggleReservation: (formData: FormData) => Promise<void>;
  deleteReservation: (formData: FormData) => Promise<void>;
};

function toUpdateFormData(
  reservationId: string,
  settings: AirconSettings,
  time: string,
): FormData {
  const formData = new FormData();
  formData.set("reservationId", reservationId);
  formData.set("reservationTime", time);
  formData.set("mode", settings.mode);
  formData.set("baseTemperature", String(settings.baseTemperature));

  ROOM_NAMES.forEach((room) => {
    formData.set(`room-${room}`, String(settings.roomOffsets[room]));
  });

  return formData;
}

export function ReservationsForm({
  currentSettings,
  initialReservations,
  addReservation,
  updateReservation,
  toggleReservation,
  deleteReservation,
}: ReservationsFormProps) {
  const [reservationTime, setReservationTime] = useState("07:00");
  const [reservations, setReservations] = useState(initialReservations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [prevInitialReservations, setPrevInitialReservations] = useState(initialReservations);

  if (prevInitialReservations !== initialReservations) {
    setPrevInitialReservations(initialReservations);
    setReservations(initialReservations);
  }

  const toggleExpand = (reservationId: string) => {
    if (expandedId === reservationId) {
      setExpandedId(null);
    } else {
      setExpandedId(reservationId);
    }
  };

  const persistReservation = (nextReservation: AirconReservation) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextReservation.time)) {
      return;
    }

    startTransition(() => {
      void updateReservation(
        toUpdateFormData(
          nextReservation.id,
          nextReservation.settings,
          nextReservation.time,
        ),
      );
    });
  };

  const updateEditedReservation = (
    reservationId: string,
    updater: (reservation: AirconReservation) => AirconReservation,
  ) => {
    const currentReservation = reservations.find(
      (reservation) => reservation.id === reservationId,
    );

    if (!currentReservation) {
      return;
    }

    const nextReservation = updater(currentReservation);

    setReservations((previous) =>
      previous.map((reservation) =>
        reservation.id === reservationId ? nextReservation : reservation,
      ),
    );

    persistReservation(nextReservation);
  };

  const updateEditMode = (reservationId: string, mode: AirconSettings["mode"]) => {
    updateEditedReservation(reservationId, (reservation) => ({
      ...reservation,
      settings: { ...reservation.settings, mode },
    }));
  };

  const updateEditBaseTemperature = (reservationId: string, baseTemperature: number) => {
    updateEditedReservation(reservationId, (reservation) => ({
      ...reservation,
      settings: {
        ...reservation.settings,
        baseTemperature: clampTemperature(baseTemperature),
      },
    }));
  };

  const updateEditRoomOffset = (reservationId: string, room: RoomName, offset: number) => {
    updateEditedReservation(reservationId, (reservation) => ({
      ...reservation,
      settings: {
        ...reservation.settings,
        roomOffsets: {
          ...reservation.settings.roomOffsets,
          [room]: clampOffset(offset),
        },
      },
    }));
  };

  const updateEditTime = (reservationId: string, time: string) => {
    updateEditedReservation(reservationId, (reservation) => ({
      ...reservation,
      time,
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
      settings: currentSettings,
    };

    setReservations((previous) =>
      [...previous, optimisticReservation].sort((a, b) => a.time.localeCompare(b.time)),
    );

    const formData = new FormData();
    formData.set("reservationTime", reservationTime);

    startTransition(() => {
      void addReservation(formData);
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

    if (expandedId === reservationId) {
      setExpandedId(null);
    }

    const formData = new FormData();
    formData.set("reservationId", reservationId);

    startTransition(() => {
      void deleteReservation(formData);
    });
  };

  const sortedReservations = [...reservations].sort((a, b) =>
    a.time.localeCompare(b.time),
  );

  return (
    <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="time"
            step={60}
            aria-label="時刻"
            value={reservationTime}
            onChange={(event) => setReservationTime(event.target.value)}
            className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={createReservation}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            予約追加
          </button>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          {sortedReservations.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">予約はありません。</p>
          )}

          {sortedReservations.map((reservation) => {
            const isExpanded = expandedId === reservation.id;

            return (
              <div
                key={reservation.id}
                className="rounded-md border border-zinc-200 text-sm dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(reservation.id)}
                    className="flex items-center gap-1.5 font-medium"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                    {reservation.time}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {getModeLabel(reservation.settings.mode)}
                      {" / "}
                      基準 {reservation.settings.baseTemperature}℃
                    </span>
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

                {isExpanded && (
                  <div className="border-t border-zinc-200 p-2.5 sm:p-3 dark:border-zinc-800">
                    <div className="space-y-3 sm:space-y-4">
                      <label className="block space-y-1">
                        <span className="text-sm font-medium">予約時刻</span>
                        <input
                          type="time"
                          step={60}
                          value={reservation.time}
                          onChange={(event) =>
                            updateEditTime(reservation.id, event.target.value)
                          }
                          className="block rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
                        />
                      </label>

                      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                        <ModeButtonGroup
                          label="動作モード"
                          ariaLabel="動作モード"
                          value={reservation.settings.mode}
                          onChange={(mode) => updateEditMode(reservation.id, mode)}
                        />

                        <BaseTemperatureStepper
                          label="基準温度"
                          value={reservation.settings.baseTemperature}
                          min={16}
                          max={30}
                          onChange={(temp) =>
                            updateEditBaseTemperature(reservation.id, temp)
                          }
                        />
                      </div>

                      <RoomOffsetGrid
                        title="各部屋温度補正（基準温度比）"
                        offsets={reservation.settings.roomOffsets}
                        onChange={(room, offset) =>
                          updateEditRoomOffset(reservation.id, room, offset)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isPending ? "保存中..." : "予約は現在設定と独立して管理されます"}
      </p>
    </div>
  );
}
