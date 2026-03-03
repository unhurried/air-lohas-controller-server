import { ROOM_NAMES, type RoomName } from "@/lib/aircon-types";

const sliderClassName =
  "w-full appearance-none rounded-lg bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-300 dark:[&::-webkit-slider-runnable-track]:bg-zinc-700 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-300 dark:[&::-moz-range-track]:bg-zinc-700 [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-900 dark:[&::-webkit-slider-thumb]:bg-zinc-100 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-zinc-900 dark:[&::-moz-range-thumb]:bg-zinc-100";

type RoomOffsetGridProps = {
  title: string;
  offsets: Record<RoomName, number>;
  onChange: (room: RoomName, offset: number) => void;
};

export function RoomOffsetGrid({ title, offsets, onChange }: RoomOffsetGridProps) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-2 grid gap-2.5 sm:mt-3 sm:gap-3 sm:grid-cols-2">
        {ROOM_NAMES.map((room) => (
          <label key={room} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">{room}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                {offsets[room] > 0 ? `+${offsets[room]}` : offsets[room]}
              </span>
            </div>
            <input
              type="range"
              min={-2}
              max={2}
              step={1}
              value={offsets[room]}
              onChange={(event) => onChange(room, Number(event.target.value))}
              className={sliderClassName}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
