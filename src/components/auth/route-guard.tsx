"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "./demo-auth-provider";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { getSessionHome } from "@/lib/demo-auth";

export function RouteGuard({
  role,
  vendorId,
  driverId,
  children,
}: {
  role: "authenticated" | "operations" | "controller" | "driver";
  vendorId?: string;
  driverId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { hydrated, session } = useDemoAuth();
  const allowed =
    role === "authenticated"
      ? Boolean(session)
      : role === "operations"
        ? session?.role === "operations"
        : role === "controller"
          ? session?.role === "controller" && session.vendorId === vendorId
          : session?.role === "driver" &&
            session.vendorId === vendorId &&
            session.driverId === driverId;

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace("/");
    } else if (!allowed) {
      router.replace(getSessionHome(session));
    }
  }, [allowed, hydrated, router, session]);

  if (!hydrated || !session || !allowed) {
    return <LoadingScreen message="Opening workspace…" />;
  }

  return children;
}
