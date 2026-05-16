import type { AirconMode } from "@/lib/aircon-types";
import { MODE_OPTIONS } from "@/lib/aircon-mode";

type ModeButtonGroupProps = {
  label: string;
  ariaLabel: string;
  value: AirconMode;
  onChange: (mode: AirconMode) => void;
};

export function ModeButtonGroup({
  label,
  ariaLabel,
  value,
  onChange,
}: ModeButtonGroupProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div
        className="grid grid-cols-4 gap-2"
        role="group"
        aria-label={ariaLabel}
      >
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-md border px-3 py-2 text-sm ${
              value === option.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
