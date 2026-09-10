import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr";
import { RouteGuard } from "@/components/auth/route-guard";
import { CreateTripForm } from "@/components/operations/create-trip-dialog";

export const metadata = {
  title: "New Trip",
};

export default function NewTripPage() {
  return (
    <RouteGuard role="operations">
      <main className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link
            href="/ops/trips"
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeftIcon size={16} />
            Back to trips
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create a trip
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose the customer, vehicle, and logistics vendor, then define the
            collection route.
          </p>
        </div>
        <section className="rounded-xl border border-border bg-surface p-5 shadow-[0_12px_32px_rgb(20_22_26/8%)] sm:p-7">
          <CreateTripForm />
        </section>
      </div>
      </main>
    </RouteGuard>
  );
}
