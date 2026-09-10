import {
  GoogleMapsLocationNotFoundError,
  GoogleMapsResolutionError,
  InvalidGoogleMapsLinkError,
} from "@/domain/errors";

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 5_000;

type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GoogleMapsLocation = {
  name: string;
  lat: number;
  lng: number;
};

export class GoogleMapsService {
  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async resolve(input: string): Promise<GoogleMapsLocation> {
    let url = parseAndValidateUrl(input);

    if (isShortMapsUrl(url)) {
      url = await this.followShortLink(url);
    }

    return parseLocation(url);
  }

  private async followShortLink(initialUrl: URL): Promise<URL> {
    let currentUrl = initialUrl;

    try {
      for (let redirectCount = 0; redirectCount < MAX_REDIRECTS; redirectCount++) {
        const response = await this.fetchImpl(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            Accept: "text/html",
            "User-Agent": "AWR-Google-Maps-Resolver/1.0",
          },
        });

        if (!isRedirect(response.status)) {
          await response.body?.cancel();
          throw new GoogleMapsResolutionError();
        }

        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) {
          throw new GoogleMapsResolutionError();
        }

        currentUrl = parseAndValidateUrl(
          new URL(location, currentUrl).toString(),
        );

        if (!isShortMapsUrl(currentUrl)) {
          return currentUrl;
        }
      }
    } catch (error) {
      if (
        error instanceof InvalidGoogleMapsLinkError ||
        error instanceof GoogleMapsResolutionError
      ) {
        throw error;
      }
      throw new GoogleMapsResolutionError();
    }

    throw new GoogleMapsResolutionError("The Google Maps link redirected too many times");
  }
}

function parseAndValidateUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new InvalidGoogleMapsLinkError();
  }

  if (url.protocol !== "https:" || !isAllowedMapsUrl(url)) {
    throw new InvalidGoogleMapsLinkError(
      "Only HTTPS Google Maps links are supported",
    );
  }

  return url;
}

function isAllowedMapsUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "maps.app.goo.gl") {
    return true;
  }
  if (hostname === "goo.gl") {
    return url.pathname === "/maps" || url.pathname.startsWith("/maps/");
  }
  if (hostname === "maps.google.com") {
    return true;
  }
  return (
    (hostname === "google.com" || hostname.endsWith(".google.com")) &&
    (url.pathname === "/maps" || url.pathname.startsWith("/maps/"))
  );
}

function isShortMapsUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return hostname === "maps.app.goo.gl" || hostname === "goo.gl";
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function parseLocation(url: URL): GoogleMapsLocation {
  const source = `${url.pathname}${url.search}${url.hash}`;
  const exactCoordinates = source.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  );
  const viewportCoordinates = url.pathname.match(
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|$)/,
  );
  const queryCoordinates = parseQueryCoordinates(url);
  const coordinates = exactCoordinates
    ? toCoordinates(exactCoordinates[1], exactCoordinates[2])
    : viewportCoordinates
      ? toCoordinates(viewportCoordinates[1], viewportCoordinates[2])
      : queryCoordinates;
  const name = parsePlaceName(url);

  if (!name || !coordinates) {
    throw new GoogleMapsLocationNotFoundError();
  }

  return { name, ...coordinates };
}

function parsePlaceName(url: URL) {
  const segments = url.pathname.split("/");
  const markerIndex = segments.findIndex(
    (segment) => segment === "place" || segment === "search",
  );
  const pathName =
    markerIndex >= 0 ? decodePart(segments[markerIndex + 1] ?? "") : "";

  if (pathName && !looksLikeCoordinates(pathName)) {
    return normalizeName(pathName);
  }

  for (const key of ["query", "q"]) {
    const queryName = url.searchParams.get(key);
    if (queryName && !looksLikeCoordinates(queryName)) {
      return normalizeName(queryName);
    }
  }

  return "";
}

function parseQueryCoordinates(url: URL) {
  for (const key of ["query", "q", "ll"]) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const match = value.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s|$)/,
    );
    if (match) {
      return toCoordinates(match[1], match[2]);
    }
  }
  return null;
}

function looksLikeCoordinates(value: string) {
  return /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?(?:\s|$)/.test(value);
}

function decodePart(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    throw new InvalidGoogleMapsLinkError("The Google Maps link is malformed");
  }
}

function normalizeName(value: string) {
  return value.replace(/\+/g, " ").replace(/\s+/g, " ").trim();
}

function toCoordinates(latValue: string | undefined, lngValue: string | undefined) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new GoogleMapsLocationNotFoundError(
      "The Google Maps link contains invalid coordinates",
    );
  }
  return { lat, lng };
}
