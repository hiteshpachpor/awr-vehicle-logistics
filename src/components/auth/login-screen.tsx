"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BuildingsIcon,
  ShieldCheckIcon,
  SteeringWheelIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { SearchSelect } from "@/components/ui/search-select";
import { useDemoAuth } from "./demo-auth-provider";
import { getSessionHome, type DemoSession } from "@/lib/demo-auth";
import { getApiErrorMessage } from "@/lib/operations-ui";
import type {
  ApiErrorBody,
  DriverOption,
  VendorOption,
} from "@/lib/operations-types";
import { cn } from "@/lib/utils";

type AccountType = "operations" | "vendor";
type VendorIdentity = "controller" | "driver";

export function LoginScreen() {
  const router = useRouter();
  const { hydrated, session, login } = useDemoAuth();
  const [accountType, setAccountType] = useState<AccountType>("operations");
  const [vendorIdentity, setVendorIdentity] =
    useState<VendorIdentity>("controller");
  const [vendorId, setVendorId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [password, setPassword] = useState("");
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && session) router.replace(getSessionHome(session));
  }, [hydrated, router, session]);

  useEffect(() => {
    if (accountType !== "vendor" || vendors.length) return;
    let active = true;
    const loadingTimer = window.setTimeout(() => setLoadingOptions(true), 0);
    fetch("/api/vendors", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as
          | { data: VendorOption[] }
          | ApiErrorBody;
        if (!response.ok || !("data" in body)) {
          throw new Error(getApiErrorMessage(body as ApiErrorBody));
        }
        if (active) setVendors(body.data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Vendors could not load.",
          );
        }
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
      window.clearTimeout(loadingTimer);
    };
  }, [accountType, vendors.length]);

  useEffect(() => {
    if (
      accountType !== "vendor" ||
      vendorIdentity !== "driver" ||
      !vendorId
    ) {
      return;
    }

    const controller = new AbortController();
    const loadingTimer = window.setTimeout(() => setLoadingOptions(true), 0);
    fetch(`/api/drivers?vendorId=${encodeURIComponent(vendorId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
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
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "Drivers could not load.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingOptions(false);
      });
    return () => {
      window.clearTimeout(loadingTimer);
      controller.abort();
    };
  }, [accountType, vendorId, vendorIdentity]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== "password") {
      setError('Enter "password" to continue.');
      return;
    }

    let nextSession: DemoSession;
    if (accountType === "operations") {
      nextSession = { role: "operations" };
    } else {
      const vendor = vendors.find((option) => option.id === vendorId);
      if (!vendor) {
        setError("Choose a logistics vendor.");
        return;
      }
      if (vendorIdentity === "controller") {
        nextSession = {
          role: "controller",
          vendorId: vendor.id,
          vendorName: vendor.name,
        };
      } else {
        const driver = drivers.find((option) => option.id === driverId);
        if (!driver) {
          setError("Choose a driver.");
          return;
        }
        nextSession = {
          role: "driver",
          vendorId: vendor.id,
          vendorName: vendor.name,
          driverId: driver.id,
          driverName: driver.name,
        };
      }
    }

    login(nextSession);
    router.replace(getSessionHome(nextSession));
  }

  if (!hydrated || session) {
    return <LoadingScreen message="Opening AWR…" />;
  }

  return (
    <main className="grid min-h-[100dvh] bg-background lg:grid-cols-[minmax(320px,0.8fr)_minmax(520px,1.2fr)]">
      <section className="flex min-h-64 flex-col justify-between bg-[#292124] p-7 text-[#fffafa] sm:p-10 lg:p-12">
        <span className="grid h-11 w-16 place-items-center rounded-[10px] bg-primary text-base font-semibold">
          AWR
        </span>
        <div className="max-w-md py-12">
          <p className="text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
            Vehicle movements, clear from handoff to delivery.
          </p>
          <p className="mt-5 max-w-sm text-sm leading-6 text-[#d9cfd2]">
            A shared live workspace for AWR Operations and logistics partners.
          </p>
        </div>
        <p className="text-xs text-[#b9adb1]">Demo operations environment</p>
      </section>

      <section className="grid place-items-center px-4 py-10 sm:px-8">
        <form
          className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-[0_18px_50px_rgb(20_22_26/10%)] sm:p-8"
          onSubmit={handleSubmit}
        >
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Choose the workspace you need for this session.
          </p>

          <div className="mt-7 grid grid-cols-2 gap-2">
            <AccountButton
              active={accountType === "operations"}
              icon={<ShieldCheckIcon size={19} />}
              label="AWR Operations"
              onClick={() => {
                setAccountType("operations");
                setDrivers([]);
                setDriverId("");
                setError(null);
              }}
            />
            <AccountButton
              active={accountType === "vendor"}
              icon={<BuildingsIcon size={19} />}
              label="Logistics Vendor"
              onClick={() => {
                setAccountType("vendor");
                setError(null);
              }}
            />
          </div>

          <div className="mt-6 grid gap-5">
            {accountType === "vendor" ? (
              <>
                <FormField label="Vendor" htmlFor="login-vendor">
                  <SearchSelect
                    id="login-vendor"
                    value={vendorId}
                    onValueChange={(value) => {
                      setVendorId(value);
                      setDrivers([]);
                      setDriverId("");
                    }}
                    options={vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    }))}
                    placeholder={
                      loadingOptions ? "Loading vendors…" : "Choose vendor"
                    }
                    searchPlaceholder="Search vendors"
                    disabled={loadingOptions && !vendors.length}
                  />
                </FormField>

                <fieldset>
                  <legend className="text-sm font-semibold">Sign in as</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <AccountButton
                      active={vendorIdentity === "controller"}
                      icon={<BuildingsIcon size={18} />}
                      label="Controller"
                      onClick={() => {
                        setVendorIdentity("controller");
                        setDrivers([]);
                        setDriverId("");
                      }}
                    />
                    <AccountButton
                      active={vendorIdentity === "driver"}
                      icon={<SteeringWheelIcon size={18} />}
                      label="Driver"
                      onClick={() => setVendorIdentity("driver")}
                    />
                  </div>
                </fieldset>

                {vendorIdentity === "driver" ? (
                  <FormField label="Driver" htmlFor="login-driver">
                    <SearchSelect
                      id="login-driver"
                      value={driverId}
                      onValueChange={setDriverId}
                      options={drivers.map((driver) => ({
                        value: driver.id,
                        label: driver.name,
                        description: driver.externalReference ?? undefined,
                      }))}
                      placeholder={
                        !vendorId
                          ? "Choose a vendor first"
                          : loadingOptions
                            ? "Loading drivers…"
                            : "Choose driver"
                      }
                      searchPlaceholder="Search drivers"
                      disabled={!vendorId || loadingOptions}
                    />
                  </FormField>
                ) : null}
              </>
            ) : null}

            <FormField
              label="Password"
              htmlFor="login-password"
              helper={
                <>
                  Demo hint: use <strong>password</strong>.
                </>
              }
            >
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="login-password-description"
                required
              />
            </FormField>

            {error ? (
              <InlineAlert className="font-medium">{error}</InlineAlert>
            ) : null}

            <Button
              type="submit"
              className="h-11"
              disabled={
                accountType === "vendor" &&
                (!vendorId ||
                  (vendorIdentity === "driver" && !driverId) ||
                  loadingOptions)
              }
            >
              Continue
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}
function AccountButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-14 items-center gap-2 rounded-[10px] border px-3 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary/8 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
