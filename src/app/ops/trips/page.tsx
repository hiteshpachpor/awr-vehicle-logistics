import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function OperationsTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  return <OperationsDashboard createdReference={created} />;
}
