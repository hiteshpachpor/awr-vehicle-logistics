import { RouteGuard } from "@/components/auth/route-guard";
import { TripFocusWorkspace } from "@/components/operations/trip-focus-workspace";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RouteGuard role="authenticated">
      <TripFocusWorkspace tripId={id} />
    </RouteGuard>
  );
}
