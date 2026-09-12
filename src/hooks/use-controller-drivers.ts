"use client";

import { useEffect, useRef, useState } from "react";
import type { TripNotice } from "@/hooks/use-trip-notice";
import { isController, type DemoSession } from "@/lib/demo-auth";
import type { ApiErrorBody, DriverOption } from "@/lib/operations-types";
import { getApiErrorMessage } from "@/lib/operations-ui";

export function useControllerDrivers(
  session: DemoSession | null,
  onError: (notice: TripNotice) => void,
) {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!isController(session) || drivers.length) return;

    const query = `?vendorId=${encodeURIComponent(session.vendorId)}`;
    void fetch(`/api/drivers${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as
          | { data: DriverOption[] }
          | ApiErrorBody;
        if (!response.ok || !("data" in body)) {
          throw new Error(getApiErrorMessage(body as ApiErrorBody));
        }
        setDrivers(body.data);
      })
      .catch((reason: unknown) => {
        onErrorRef.current({
          type: "error",
          title: "Drivers could not be loaded",
          description:
            reason instanceof Error ? reason.message : "Try refreshing.",
        });
      });
  }, [drivers.length, session]);

  return drivers;
}
