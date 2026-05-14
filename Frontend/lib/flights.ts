export type FlightTripType = "round_trip" | "one_way" | "multi_city";
export type TravelClass = "economy" | "premium_economy" | "business" | "first_class";
export type StopsFilter = "any" | "nonstop" | "one_stop_or_fewer" | "two_stops_or_fewer";

export type MultiCityLeg = {
  departureId: string;
  arrivalId: string;
  outboundDate: string;
};

export type FlightSearchParams = {
  departureId?: string;
  arrivalId?: string;
  outboundDate?: string;
  returnDate?: string;
  flightType: FlightTripType;
  multiCityLegs?: MultiCityLeg[];
  travelClass?: TravelClass;
  stops?: StopsFilter;
  adults?: number;
  maxPrice?: number;
  carryOnBags?: number;
  checkedBags?: number;
  departureToken?: string;
  bookingToken?: string;
};

export type FlightSegment = {
  airline: string;
  airlineLogo?: string;
  flightNumber?: string;
  airplane?: string;
  travelClass?: string;
  departureAirport: string;
  departureId: string;
  departureDate: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalId: string;
  arrivalDate: string;
  arrivalTime: string;
  durationMinutes?: number;
};

export type FlightOffer = {
  id: string;
  airline: string;
  airlineLogo?: string;
  from: string;
  to: string;
  duration: string;
  durationMinutes?: number;
  price: number;
  type: string;
  stops: number;
  layovers: string[];
  emissionsPercent?: number;
  departureToken?: string;
  bookingToken?: string;
  segments: FlightSegment[];
};

type SearchApiAirport = {
  name?: string;
  id?: string;
  date?: string;
  time?: string;
};

type SearchApiFlightSegment = {
  departure_airport?: SearchApiAirport;
  arrival_airport?: SearchApiAirport;
  duration?: number;
  airplane?: string;
  airline?: string;
  airline_logo?: string;
  travel_class?: string;
  flight_number?: string;
};

type SearchApiLayover = {
  duration?: number;
  name?: string;
  id?: string;
};

type SearchApiFlightOffer = {
  flights?: SearchApiFlightSegment[];
  layovers?: SearchApiLayover[];
  total_duration?: number;
  carbon_emissions?: {
    difference_percent?: number;
  };
  price?: number;
  type?: string;
  airline_logo?: string;
  departure_token?: string;
  booking_token?: string;
};

type SearchApiResponse = {
  best_flights?: SearchApiFlightOffer[];
  other_flights?: SearchApiFlightOffer[];
  error?: string;
};

const SEARCH_API_URL = "https://www.searchapi.io/api/v1/search";
const airportAliases: Record<string, string> = {
  "norfolk": "ORF",
  "norfolk international airport": "ORF",
  "norfolk va": "ORF",
  "orlando": "MCO",
  "atlanta": "ATL",
  "richmond": "RIC",
  "raleigh": "RDU",
  "raleigh durham": "RDU",
  "charlotte": "CLT",
  "washington dc": "DCA",
  "new york": "JFK",
  "los angeles": "LAX",
  "chicago": "ORD",
  "houston": "IAH",
  "miami": "MIA",
  "seattle": "SEA",
};

function formatMinutes(minutes?: number) {
  if (!minutes || minutes < 1) {
    return "Duration unavailable";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function normalizeAirportCode(value: string) {
  const trimmed = value.trim();
  const alias = airportAliases[trimmed.toLowerCase()];

  if (alias) {
    return alias;
  }

  const parenthesizedCode = trimmed.toUpperCase().match(/[\[(]([A-Z]{3})[\])]/);

  if (parenthesizedCode) {
    return parenthesizedCode[1];
  }

  const exactCode = trimmed.match(/^[A-Z]{3}$/);

  if (exactCode) {
    return exactCode[0];
  }

  const looseCode = trimmed.toUpperCase().match(/\b[A-Z]{3}\b/);
  return looseCode?.[0] ?? trimmed.toUpperCase();
}

function mapOffer(offer: SearchApiFlightOffer, index: number): FlightOffer | null {
  const segments = offer.flights ?? [];
  const firstSegment = segments[0];
  const finalSegment = segments[segments.length - 1];

  if (!firstSegment || !finalSegment || typeof offer.price !== "number") {
    return null;
  }

  const normalizedSegments = segments.map((segment) => ({
    airline: segment.airline ?? "Airline unavailable",
    airlineLogo: segment.airline_logo,
    flightNumber: segment.flight_number,
    airplane: segment.airplane,
    travelClass: segment.travel_class,
    departureAirport: segment.departure_airport?.name ?? "Departure airport",
    departureId: segment.departure_airport?.id ?? "",
    departureDate: segment.departure_airport?.date ?? "",
    departureTime: segment.departure_airport?.time ?? "",
    arrivalAirport: segment.arrival_airport?.name ?? "Arrival airport",
    arrivalId: segment.arrival_airport?.id ?? "",
    arrivalDate: segment.arrival_airport?.date ?? "",
    arrivalTime: segment.arrival_airport?.time ?? "",
    durationMinutes: segment.duration,
  }));

  return {
    id: `${offer.booking_token ?? offer.departure_token ?? "flight"}-${index}`,
    airline: firstSegment.airline ?? "Airline unavailable",
    airlineLogo: offer.airline_logo ?? firstSegment.airline_logo,
    from: firstSegment.departure_airport?.id ?? "",
    to: finalSegment.arrival_airport?.id ?? "",
    duration: formatMinutes(offer.total_duration),
    durationMinutes: offer.total_duration,
    price: offer.price,
    type: offer.type ?? "Flight",
    stops: Math.max(segments.length - 1, 0),
    layovers: (offer.layovers ?? []).map((layover) => {
      const name = layover.name ?? layover.id ?? "Layover";
      return `${name}${layover.duration ? `, ${formatMinutes(layover.duration)}` : ""}`;
    }),
    emissionsPercent: offer.carbon_emissions?.difference_percent,
    departureToken: offer.departure_token,
    bookingToken: offer.booking_token,
    segments: normalizedSegments,
  };
}

export async function searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
  const apiKey = process.env.SEARCHAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY is not configured.");
  }

  const requestParams = new URLSearchParams({
    engine: "google_flights",
    flight_type: params.flightType,
    travel_class: params.travelClass ?? "economy",
    stops: params.stops ?? "any",
    adults: String(params.adults ?? 1),
    api_key: apiKey,
  });

  if (params.flightType === "multi_city") {
    const multiCityLegs = params.multiCityLegs ?? [];

    if (multiCityLegs.length < 2) {
      throw new Error("Add at least two legs for a multi-city search.");
    }

    requestParams.set(
      "multi_city_json",
      JSON.stringify(
        multiCityLegs.map((leg) => ({
          departure_id: normalizeAirportCode(leg.departureId),
          arrival_id: normalizeAirportCode(leg.arrivalId),
          outbound_date: leg.outboundDate,
        })),
      ),
    );
  } else {
    if (!params.departureId || !params.arrivalId || !params.outboundDate) {
      throw new Error("Departure, arrival, and outbound date are required.");
    }

    requestParams.set("departure_id", normalizeAirportCode(params.departureId));
    requestParams.set("arrival_id", normalizeAirportCode(params.arrivalId));
    requestParams.set("outbound_date", params.outboundDate);
  }

  if (params.flightType === "round_trip" && params.returnDate) {
    requestParams.set("return_date", params.returnDate);
  }

  if (params.maxPrice) {
    requestParams.set("max_price", String(params.maxPrice));
  }

  if (params.carryOnBags) {
    requestParams.set("carry_on_bags", String(params.carryOnBags));
  }

  if (params.checkedBags) {
    requestParams.set("checked_bags", String(params.checkedBags));
  }

  if (params.departureToken) {
    requestParams.set("departure_token", params.departureToken);
  }

  if (params.bookingToken) {
    requestParams.set("booking_token", params.bookingToken);
  }

  const response = await fetch(`${SEARCH_API_URL}?${requestParams.toString()}`, {
    cache: "no-store",
  });
  const result = (await response.json()) as SearchApiResponse;

  if (!response.ok || result.error) {
    throw new Error(result.error ?? "Unable to search flights.");
  }

  return [...(result.best_flights ?? []), ...(result.other_flights ?? [])]
    .map(mapOffer)
    .filter((offer): offer is FlightOffer => Boolean(offer));
}
