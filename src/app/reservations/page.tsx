import { revalidatePath } from "next/cache";
import Link from "next/link";
import type { AirconReservation } from "@/lib/aircon-types";
import {
  getAppState,
  getReservations,
  parseSettingsFromFormData,
  saveReservations,
} from "@/lib/aircon-settings";
import { ReservationsForm } from "@/components/reservations-form";
import { RefreshOnFocus } from "@/components/refresh-on-focus";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const { currentSettings, reservations } = await getAppState();

  async function addReservation(formData: FormData) {
    "use server";

    const reservationTimeRaw = String(formData.get("reservationTime") ?? "");
    const reservationTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(reservationTimeRaw)
      ? reservationTimeRaw
      : "00:00";

    const { currentSettings: latestSettings } = await getAppState();

    const nextReservation: AirconReservation = {
      id: crypto.randomUUID(),
      time: reservationTime,
      enabled: true,
      settings: {
        mode: latestSettings.mode,
        baseTemperature: latestSettings.baseTemperature,
        roomOffsets: latestSettings.roomOffsets,
      },
    };

    const existingReservations = await getReservations();
    await saveReservations([...existingReservations, nextReservation]);

    revalidatePath("/reservations");
  }

  async function updateReservation(formData: FormData) {
    "use server";

    const reservationId = String(formData.get("reservationId") ?? "");
    const reservationTimeRaw = String(formData.get("reservationTime") ?? "");
    const reservationTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(reservationTimeRaw)
      ? reservationTimeRaw
      : "00:00";

    const settings = parseSettingsFromFormData(
      formData,
      currentSettings.roomOffsets,
    );

    const existingReservations = await getReservations();

    await saveReservations(
      existingReservations.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, time: reservationTime, settings }
          : reservation,
      ),
    );

    revalidatePath("/reservations");
  }

  async function toggleReservation(formData: FormData) {
    "use server";

    const reservationId = String(formData.get("reservationId") ?? "");
    const enabled = String(formData.get("enabled") ?? "") === "true";
    const existingReservations = await getReservations();

    await saveReservations(
      existingReservations.map((reservation) =>
        reservation.id === reservationId ? { ...reservation, enabled } : reservation,
      ),
    );

    revalidatePath("/reservations");
  }

  async function deleteReservation(formData: FormData) {
    "use server";

    const reservationId = String(formData.get("reservationId") ?? "");
    const existingReservations = await getReservations();

    await saveReservations(
      existingReservations.filter((reservation) => reservation.id !== reservationId),
    );

    revalidatePath("/reservations");
  }

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-4 sm:py-10">
      <RefreshOnFocus />
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold sm:text-2xl">予約設定</h1>
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm dark:border-zinc-700"
          >
            現在設定へ
          </Link>
        </div>

        <ReservationsForm
          currentSettings={currentSettings}
          initialReservations={reservations}
          addReservation={addReservation}
          updateReservation={updateReservation}
          toggleReservation={toggleReservation}
          deleteReservation={deleteReservation}
        />
      </section>
    </main>
  );
}
