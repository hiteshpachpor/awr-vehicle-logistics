import { TripListWorkspace } from "@/components/operations/trip-list-workspace";

export default async function OperationsTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  return <TripListWorkspace createdReference={created} />;
}
