import { revalidatePath } from "next/cache";
import Link from "next/link";
import {
  getSettings,
  parseSettingsFromFormData,
  saveSettings,
} from "@/lib/aircon-settings";
import { SettingsForm } from "@/components/settings-form";
import { RefreshOnFocus } from "@/components/refresh-on-focus";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();

  async function updateSettings(formData: FormData) {
    "use server";

    const currentSettings = await getSettings();
    await saveSettings(
      parseSettingsFromFormData(formData, currentSettings.roomOffsets),
    );

    revalidatePath("/");
  }

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-10">
      <RefreshOnFocus />
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold sm:text-2xl">Air LOHAS 設定</h1>
          <Link
            href="/reservations"
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm dark:border-zinc-700"
          >
            予約設定へ
          </Link>
        </div>

        <SettingsForm
          initialSettings={settings}
          updateSettings={updateSettings}
        />
      </section>
    </main>
  );
}
