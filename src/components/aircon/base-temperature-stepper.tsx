type BaseTemperatureStepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function BaseTemperatureStepper({
  label,
  value,
  min,
  max,
  onChange,
}: BaseTemperatureStepperProps) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label="基準温度を下げる"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-base sm:h-9 sm:w-9 sm:text-lg disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          ▼
        </button>
        <div className="flex h-8 min-w-20 items-center justify-center rounded-md border border-zinc-300 px-2 text-sm sm:h-9 sm:min-w-24 sm:px-3 dark:border-zinc-700">
          {value}℃
        </div>
        <button
          type="button"
          aria-label="基準温度を上げる"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-base sm:h-9 sm:w-9 sm:text-lg disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700"
        >
          ▲
        </button>
      </div>
    </label>
  );
}
