import { resolveGoogleMapsLinkHandler } from "@/http/google-maps-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return resolveGoogleMapsLinkHandler(request);
}
