import { cn } from "@/lib/utils";

export function VehiclePlate({
  registrationNumber,
  className,
}: {
  registrationNumber: string;
  className?: string;
}) {
  return (
    <span
      aria-label={`Registration ${registrationNumber}`}
      className={cn(
        "inline-flex h-5 items-center rounded-[3px] border border-[#202124] bg-white px-1.5 text-[10px] font-semibold leading-none tracking-[0.06em] text-[#111214]",
        className,
      )}
    >
      {registrationNumber}
    </span>
  );
}
