"use client";

import Link from "next/link";
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  PlusIcon,
  SignOutIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { TripNotice } from "@/hooks/use-trip-notice";
import { cn } from "@/lib/utils";

export function WorkspaceShell({
  layout,
  chrome,
  homeHref,
  lastRefresh,
  loading,
  onRefresh,
  canCreateTrip,
  onSignOut,
  notice,
  children,
}: {
  layout: "list" | "focus";
  chrome: { title: string; mark: string; markColor: string };
  homeHref: string;
  lastRefresh: Date | null;
  loading: boolean;
  onRefresh: () => void;
  canCreateTrip: boolean;
  onSignOut: () => void;
  notice: TripNotice | null;
  children: React.ReactNode;
}) {
  return (
    <main
      className={cn(
        "flex min-h-[100dvh] flex-col bg-background",
        layout === "focus"
          ? "h-[100dvh] overflow-hidden"
          : "lg:h-[100dvh] lg:overflow-hidden",
      )}
    >
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
        <Link
          href={homeHref}
          aria-label="Go to trips index"
          className="flex min-w-0 items-center gap-3 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className={`grid h-9 min-w-12 place-items-center rounded-[10px] px-2 text-sm font-semibold tracking-tight ${chrome.markColor}`}
          >
            {chrome.mark}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{chrome.title}</h1>
            {lastRefresh ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Updated{" "}
                <time dateTime={lastRefresh.toISOString()}>
                  {lastRefresh.toLocaleTimeString("en-AE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
              </p>
            ) : null}
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh trips"
          >
            <ArrowClockwiseIcon
              size={18}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
          {canCreateTrip ? (
            <Button asChild>
              <Link href="/ops/trips/new">
                <PlusIcon size={17} />
                <span className="hidden sm:inline">New trip</span>
                <span className="sm:hidden">New</span>
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            onClick={onSignOut}
          >
            <SignOutIcon size={18} />
          </Button>
        </div>
      </header>
      {children}
      {notice ? (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className="fixed right-4 top-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-[0_18px_50px_rgb(20_22_26/22%)]"
        >
          {notice.type === "success" ? (
            <CheckCircleIcon
              size={20}
              weight="duotone"
              className="mt-0.5 shrink-0 text-primary"
            />
          ) : (
            <WarningCircleIcon
              size={20}
              weight="duotone"
              className="mt-0.5 shrink-0 text-destructive"
            />
          )}
          <div>
            <p className="text-sm font-semibold">{notice.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {notice.description}
            </p>
            {notice.hint ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {notice.hint}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function WorkspaceLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <div className="max-w-sm text-center">
        <WarningCircleIcon
          size={32}
          weight="duotone"
          className="mx-auto mb-3 text-destructive"
        />
        <h2 className="font-semibold">Trips are unavailable</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
