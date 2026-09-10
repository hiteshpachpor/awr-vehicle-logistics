import { NextResponse } from "next/server";
import { resolveGoogleMapsLinkSchema } from "@/domain/contracts";
import {
  GoogleMapsService,
  type GoogleMapsLocation,
} from "@/services/google-maps-service";
import { errorResponse } from "./responses";

type GoogleMapsResolver = {
  resolve(url: string): Promise<GoogleMapsLocation>;
};

const googleMapsService = new GoogleMapsService();

export async function resolveGoogleMapsLinkHandler(
  request: Request,
  resolver: GoogleMapsResolver = googleMapsService,
) {
  try {
    const input = resolveGoogleMapsLinkSchema.parse(await request.json());
    const location = await resolver.resolve(input.url);
    return NextResponse.json({ data: location });
  } catch (error) {
    return errorResponse(error);
  }
}
