"use client";

import { useEffect, useRef, useState } from "react";

export type TripNotice = {
  type: "success" | "error";
  title: string;
  description: string;
  hint?: string;
};

export function useTripNotice({
  initialNotice = null,
  onExpire,
}: {
  initialNotice?: TripNotice | null;
  onExpire?: () => void;
} = {}) {
  const [notice, setNotice] = useState<TripNotice | null>(initialNotice);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      setNotice(null);
      onExpireRef.current?.();
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return { notice, setNotice };
}
