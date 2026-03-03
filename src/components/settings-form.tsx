"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ROOM_NAMES,
  type AirconSettings,
  type RoomName,
} from "@/lib/aircon-types";
import { clampTemperature } from "@/lib/aircon-settings";
import { ModeButtonGroup } from "@/components/aircon/mode-button-group";
import { BaseTemperatureStepper } from "@/components/aircon/base-temperature-stepper";
import { RoomOffsetGrid } from "@/components/aircon/room-offset-grid";

type SettingsFormProps = {
  initialSettings: AirconSettings;
  updateSettings: (formData: FormData) => Promise<void>;
};

function toFormData(settings: AirconSettings): FormData {
  const formData = new FormData();
  formData.set("mode", settings.mode);
  formData.set("baseTemperature", String(settings.baseTemperature));

  ROOM_NAMES.forEach((room) => {
    formData.set(`room-${room}`, String(settings.roomOffsets[room]));
  });

  return formData;
}

export function SettingsForm({
  initialSettings,
  updateSettings,
}: SettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const saveSettings = (nextSettings: AirconSettings) => {
    startTransition(() => {
      void updateSettings(toFormData(nextSettings));
    });
  };

  const updateMode = (mode: AirconSettings["mode"]) => {
    const nextSettings: AirconSettings = {
      ...settings,
      mode,
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const updateBaseTemperature = (baseTemperature: number) => {
    const clampedTemperature = clampTemperature(baseTemperature);
    const nextSettings: AirconSettings = {
      ...settings,
      baseTemperature: clampedTemperature,
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const updateRoomOffset = (room: RoomName, offset: number) => {
    const nextSettings: AirconSettings = {
      ...settings,
      roomOffsets: {
        ...settings.roomOffsets,
        [room]: offset,
      },
    };

    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  return (
    <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
        <ModeButtonGroup
          label="動作モード"
          ariaLabel="動作モード"
          value={settings.mode}
          onChange={updateMode}
        />

        <BaseTemperatureStepper
          label="基準温度"
          value={settings.baseTemperature}
          min={18}
          max={25}
          onChange={updateBaseTemperature}
        />
      </div>

      <RoomOffsetGrid
        title="各部屋の温度補正（基準温度比）"
        offsets={settings.roomOffsets}
        onChange={updateRoomOffset}
      />

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isPending ? "保存中..." : "変更は自動保存されます"}
      </p>
    </div>
  );
}
