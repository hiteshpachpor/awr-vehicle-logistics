import { RouteGuard } from "@/components/auth/route-guard";

export default function OperationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RouteGuard role="operations">{children}</RouteGuard>;
}
