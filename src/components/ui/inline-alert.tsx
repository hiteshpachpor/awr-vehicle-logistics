import * as React from "react";
import { CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function InlineAlert({
  children,
  title,
  variant = "error",
  className,
}: {
  children: React.ReactNode;
  title?: string;
  variant?: "error" | "success";
  className?: string;
}) {
  const Icon = variant === "error" ? WarningCircleIcon : CheckCircleIcon;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-[10px] border p-3 text-sm",
        variant === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground",
        className,
      )}
    >
      <Icon
        size={18}
        weight="duotone"
        aria-hidden="true"
        className={cn(
          "mt-0.5 shrink-0",
          variant === "success" && "text-primary",
        )}
      />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div
          className={cn(
            title && "mt-1 leading-5",
            title && variant === "error" && "text-foreground",
            title && variant === "success" && "text-muted-foreground",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
