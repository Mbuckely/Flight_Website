import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const app = express();

/********************************************************************************************/
/* MIDDLEWARE */
/********************************************************************************************/

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean),
);

function isAllowedLocalDevOrigin(origin) {
  try {
    const { hostname, port, protocol } = new URL(origin);

    if (protocol !== "http:" || port !== "3000") {
      return false;
    }

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.") ||
      hostname.startsWith("192.168.")
    );
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin) || isAllowedLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());

const assignableRoles = new Set(["employee", "manager", "admin"]);

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function resolveSignupRole() {
  return "employee";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const SEARCH_API_URL = "https://www.searchapi.io/api/v1/search";
const flightTypes = new Set(["round_trip", "one_way", "multi_city"]);
const hotelPropertyTypes = new Set(["hotel", "vacation_rental"]);
const hotelSortOptions = new Set([
  "relevance",
  "lowest_price",
  "highest_rating",
  "most_reviewed",
]);
const hotelRatings = new Set(["7", "8", "9"]);
const searchCache = new Map();
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const travelClasses = new Set([
  "economy",
  "premium_economy",
  "business",
  "first_class",
]);
const stopFilters = new Set([
  "any",
  "nonstop",
  "one_stop_or_fewer",
  "two_stops_or_fewer",
]);
const airportAliases = {
  norfolk: "ORF",
  "norfolk international airport": "ORF",
  "norfolk va": "ORF",
  orlando: "MCO",
  atlanta: "ATL",
  richmond: "RIC",
  raleigh: "RDU",
  "raleigh durham": "RDU",
  charlotte: "CLT",
  "washington dc": "DCA",
  "new york": "JFK",
  "los angeles": "LAX",
  chicago: "ORD",
  houston: "IAH",
  miami: "MIA",
  seattle: "SEA",
};

function parsePositiveNumber(value) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatMinutes(minutes) {
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

function normalizeAirportCode(value) {
  const trimmed = normalizeText(value);
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

function getSearchCacheKey(kind, requestParams) {
  const cacheParams = new URLSearchParams(requestParams);
  cacheParams.delete("api_key");
  cacheParams.sort();
  return `${kind}:${cacheParams.toString()}`;
}

function getCachedSearchResult(cacheKey) {
  const cached = searchCache.get(cacheKey);

  if (!cached || cached.expiresAt <= Date.now()) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCachedSearchResult(cacheKey, value) {
  searchCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
}

function getBearerToken(req) {
  const authHeader = req.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

async function requireAuthenticatedUser(req, res, next) {
  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({ error: "Login is required." });
    }

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return res.status(401).json({ error: "Your session is invalid or expired." });
    }

    req.user = data.user;
    return next();
  } catch (err) {
    console.error("Auth verification error:", err);
    return res.status(500).json({ error: "Unable to verify your session." });
  }
}

async function getProfileByUserId(userId) {
  if (!userId) {
    return { profile: null, error: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, phone, first_name, last_name, role")
    .eq("id", userId)
    .maybeSingle();

  return { profile, error };
}

async function requireRoleManager(req, res, next) {
  try {
    const { profile, error } = await getProfileByUserId(req.user?.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!profile || !isRoleManager(profile.role)) {
      return res.status(403).json({ error: "Manager access is required." });
    }

    req.profile = profile;
    return next();
  } catch (err) {
    console.error("Role manager verification error:", err);
    return res.status(500).json({ error: "Unable to verify role access." });
  }
}

function mapFlightOffer(offer, index) {
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

function mapHotelProperty(property, index) {
  const totalPrice = property.total_price ?? {};
  const nightlyPrice = property.price_per_night ?? {};
  const primaryImage = property.images?.[0];
  const coordinates = property.gps_coordinates ?? {};
  const extractedTotalPrice =
    typeof totalPrice.extracted_price === "number"
      ? totalPrice.extracted_price
      : undefined;
  const extractedNightlyPrice =
    typeof nightlyPrice.extracted_price === "number"
      ? nightlyPrice.extracted_price
      : undefined;

  if (!property.name || (!extractedTotalPrice && !extractedNightlyPrice)) {
    return null;
  }

  return {
    id:
      property.property_token ??
      property.data_id ??
      `${property.name}-${property.city ?? "hotel"}-${index}`,
    type: property.type ?? "hotel",
    name: property.name,
    link: property.link,
    description: property.description ?? "",
    city: property.city ?? "",
    country: property.country ?? "",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    checkInTime: property.check_in_time,
    checkOutTime: property.check_out_time,
    pricePerNight: nightlyPrice.price ?? "",
    pricePerNightValue: extractedNightlyPrice,
    totalPrice: totalPrice.price ?? nightlyPrice.price ?? "",
    totalPriceValue: extractedTotalPrice ?? extractedNightlyPrice,
    priceBeforeTaxes: totalPrice.price_before_taxes ?? nightlyPrice.price_before_taxes,
    deal: property.deal ?? property.deal_description,
    hotelClass: property.hotel_class,
    hotelClassValue: property.extracted_hotel_class,
    rating: property.rating,
    reviews: property.reviews,
    locationRating: property.location_rating,
    airportAccessRating: property.airport_access_rating,
    amenities: Array.isArray(property.amenities) ? property.amenities.slice(0, 8) : [],
    nearbyPlaces: Array.isArray(property.nearby_places)
      ? property.nearby_places.slice(0, 3).map((place) => ({
          name: place.name ?? "",
          transportation: place.transportations?.[0]
            ? `${place.transportations[0].type ?? ""} ${place.transportations[0].duration ?? ""}`.trim()
            : "",
        }))
      : [],
    image: primaryImage?.original ?? primaryImage?.thumbnail,
    thumbnail: primaryImage?.thumbnail,
  };
}

function buildSearchApiFlightParams(query) {
  const apiKey = process.env.SEARCHAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY is not configured.");
  }

  const flightType = flightTypes.has(query.flight_type)
    ? query.flight_type
    : "round_trip";
  const requestParams = new URLSearchParams({
    engine: "google_flights",
    flight_type: flightType,
    travel_class: travelClasses.has(query.travel_class)
      ? query.travel_class
      : "economy",
    stops: stopFilters.has(query.stops) ? query.stops : "any",
    adults: String(parsePositiveNumber(query.adults) ?? 1),
    api_key: apiKey,
  });

  if (flightType === "multi_city") {
    const parsedLegs = JSON.parse(query.multi_city_json ?? "[]");

    if (
      !Array.isArray(parsedLegs) ||
      parsedLegs.length < 2 ||
      parsedLegs.some(
        (leg) => !leg.departure_id || !leg.arrival_id || !leg.outbound_date,
      )
    ) {
      throw new Error("Add at least two complete multi-city legs.");
    }

    requestParams.set(
      "multi_city_json",
      JSON.stringify(
        parsedLegs.map((leg) => ({
          departure_id: normalizeAirportCode(leg.departure_id),
          arrival_id: normalizeAirportCode(leg.arrival_id),
          outbound_date: normalizeText(leg.outbound_date),
        })),
      ),
    );
  } else {
    const departureId = normalizeText(query.departure_id);
    const arrivalId = normalizeText(query.arrival_id);
    const outboundDate = normalizeText(query.outbound_date);

    if (!departureId || !arrivalId || !outboundDate) {
      throw new Error("Departure, arrival, and outbound date are required.");
    }

    requestParams.set("departure_id", normalizeAirportCode(departureId));
    requestParams.set("arrival_id", normalizeAirportCode(arrivalId));
    requestParams.set("outbound_date", outboundDate);
  }

  if (flightType === "round_trip") {
    const returnDate = normalizeText(query.return_date);

    if (!returnDate) {
      throw new Error("Return date is required for round trip searches.");
    }

    requestParams.set("return_date", returnDate);
  }

  const maxPrice = parsePositiveNumber(query.max_price);
  const carryOnBags = parsePositiveNumber(query.carry_on_bags);
  const checkedBags = parsePositiveNumber(query.checked_bags);

  if (maxPrice) {
    requestParams.set("max_price", String(maxPrice));
  }

  if (carryOnBags) {
    requestParams.set("carry_on_bags", String(carryOnBags));
  }

  if (checkedBags) {
    requestParams.set("checked_bags", String(checkedBags));
  }

  if (query.departure_token) {
    requestParams.set("departure_token", normalizeText(query.departure_token));
  }

  if (query.booking_token) {
    requestParams.set("booking_token", normalizeText(query.booking_token));
  }

  return requestParams;
}

function buildSearchApiHotelParams(query) {
  const apiKey = process.env.SEARCHAPI_API_KEY;

  if (!apiKey) {
    throw new Error("SEARCHAPI_API_KEY is not configured.");
  }

  const searchQuery = normalizeText(query.q);
  const boundingBox = normalizeText(query.bounding_box);
  const checkInDate = normalizeText(query.check_in_date);
  const checkOutDate = normalizeText(query.check_out_date);

  if (!checkInDate || !checkOutDate) {
    throw new Error("Check-in and check-out dates are required.");
  }

  if ((!searchQuery && !boundingBox) || (searchQuery && boundingBox)) {
    throw new Error("Provide either a hotel search location or a bounding box.");
  }

  const propertyType = hotelPropertyTypes.has(query.property_type)
    ? query.property_type
    : "hotel";
  const adults = Math.min(
    parsePositiveNumber(query.adults) ?? 2,
    propertyType === "vacation_rental" ? 10 : 6,
  );
  const requestParams = new URLSearchParams({
    engine: "google_hotels",
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    property_type: propertyType,
    sort_by: hotelSortOptions.has(query.sort_by) ? query.sort_by : "relevance",
    adults: String(adults),
    currency: normalizeText(query.currency) || "USD",
    gl: normalizeText(query.gl) || "us",
    hl: normalizeText(query.hl) || "en",
    api_key: apiKey,
  });

  if (searchQuery) {
    requestParams.set("q", searchQuery);
  }

  if (boundingBox) {
    requestParams.set("bounding_box", boundingBox);
  }

  [
    "price_min",
    "price_max",
    "property_types",
    "amenities",
    "hotel_class",
    "brands",
    "bedrooms",
    "bathrooms",
    "children_ages",
    "next_page_token",
  ].forEach((key) => {
    const value = normalizeText(query[key]);

    if (value) {
      requestParams.set(key, value);
    }
  });

  if (hotelRatings.has(query.rating)) {
    requestParams.set("rating", query.rating);
  }

  [
    "free_cancellation",
    "special_offers",
    "for_displaced_individuals",
    "eco_certified",
  ].forEach((key) => {
    if (query[key] === "true") {
      requestParams.set(key, "true");
    }
  });

  return requestParams;
}

function isApprovalRole(role) {
  return role === "approver" || role === "manager" || role === "admin";
}

function isRoleManager(role) {
  return role === "manager" || role === "admin";
}

function buildRoute(fromLocation, toLocation) {
  return `${normalizeText(fromLocation)} to ${normalizeText(toLocation)}`;
}

function toApprovalRequest(row) {
  return {
    id: row.id,
    title: row.title,
    submittedBy: row.submitted_by,
    approverEmail: row.approver_email,
    approverName: row.approver_name,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    route: row.route,
    travelDates: row.travel_dates,
    roomRequirement: row.room_requirement,
    travelers: Array.isArray(row.travelers) ? row.travelers : [],
    bookingDetails: row.booking_details ?? {},
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at,
    itineraryShared: row.itinerary_shared,
  };
}

function toApprovalRow(input) {
  const fromLocation = normalizeText(input.fromLocation);
  const toLocation = normalizeText(input.toLocation);
  const row = {
    title: normalizeText(input.title) || `${toLocation} travel request`,
    submitted_by: normalizeText(input.submittedBy),
    approver_email: normalizeEmail(input.approverEmail),
    approver_name: normalizeText(input.approverName),
    from_location: fromLocation,
    to_location: toLocation,
    route: buildRoute(fromLocation, toLocation),
    travel_dates: normalizeText(input.travelDates),
    room_requirement: normalizeText(input.roomRequirement),
    travelers: Array.isArray(input.travelers)
      ? input.travelers.map(normalizeText).filter(Boolean)
      : [],
    reason: normalizeText(input.reason),
    status: input.status ?? "Pending",
    requested_at:
      normalizeText(input.requestedAt) ||
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    itinerary_shared: Boolean(input.itineraryShared),
    updated_at: new Date().toISOString(),
  };

  if (input.bookingDetails && typeof input.bookingDetails === "object") {
    row.booking_details = input.bookingDetails;
  }

  return row;
}

function toApprovalUpdateRow(input, existingRequest) {
  const nextRequest = {
    ...toApprovalRequest(existingRequest),
    ...input,
  };

  const row = toApprovalRow(nextRequest);

  if (!("bookingDetails" in input)) {
    delete row.booking_details;
  }

  return row;
}

async function getProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { profile: null, error: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, phone, first_name, last_name, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  return { profile, error };
}

function isApprovalOwnedByUser(request, profile) {
  const identifiers = [
    normalizeEmail(profile?.email),
    normalizeText(`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`).toLowerCase(),
  ].filter(Boolean);

  const submittedBy = normalizeText(request.submittedBy).toLowerCase();
  const travelers = request.travelers.map((traveler) =>
    normalizeText(traveler).toLowerCase(),
  );

  return identifiers.some(
    (identifier) => submittedBy === identifier || travelers.includes(identifier),
  );
}

function isApprovalAssignedToApprover(request, profile) {
  return normalizeEmail(request.approverEmail) === normalizeEmail(profile?.email);
}

async function findAuthUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (authUser) => normalizeEmail(authUser.email) === normalizedEmail,
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createAuthUser({ email, password }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) {
    return { data, error: null };
  }

  const isAlreadyRegistered = error.message
    .toLowerCase()
    .includes("already been registered");

  if (!isAlreadyRegistered) {
    return { data: null, error };
  }

  const existingAuthUser = await findAuthUserByEmail(email);

  if (!existingAuthUser) {
    return { data: null, error };
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", existingAuthUser.id)
    .maybeSingle();

  if (profileLookupError || existingProfile) {
    return { data: null, error };
  }

  await supabase.auth.admin.deleteUser(existingAuthUser.id);

  return supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
}

/********************************************************************************************/
/* HEALTH CHECK */
/********************************************************************************************/

app.get("/", (req, res) => {
  res.send("Backend is running");
});

/********************************************************************************************/
/* FLIGHT SEARCH ROUTE */
/********************************************************************************************/

app.get("/flights", async (req, res) => {
  try {
    const requestParams = buildSearchApiFlightParams(req.query);
    const cacheKey = getSearchCacheKey("flights", requestParams);
    const cachedFlights = getCachedSearchResult(cacheKey);

    if (cachedFlights) {
      res.set("X-Search-Cache", "hit");
      return res.json(cachedFlights);
    }

    const response = await fetch(`${SEARCH_API_URL}?${requestParams.toString()}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || result.error) {
      return res
        .status(response.ok ? 400 : response.status)
        .json({ error: result.error ?? "Unable to search flights." });
    }

    const flights = [
      ...(result.best_flights ?? []),
      ...(result.other_flights ?? []),
    ]
      .map(mapFlightOffer)
      .filter(Boolean);

    const payload = { flights };
    setCachedSearchResult(cacheKey, payload);
    res.set("X-Search-Cache", "miss");
    return res.json(payload);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to search flights.",
    });
  }
});

app.get("/hotels", async (req, res) => {
  try {
    const requestParams = buildSearchApiHotelParams(req.query);
    const cacheKey = getSearchCacheKey("hotels", requestParams);
    const cachedHotels = getCachedSearchResult(cacheKey);

    if (cachedHotels) {
      res.set("X-Search-Cache", "hit");
      return res.json(cachedHotels);
    }

    const response = await fetch(`${SEARCH_API_URL}?${requestParams.toString()}`, {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || result.error) {
      return res
        .status(response.ok ? 400 : response.status)
        .json({ error: result.error ?? "Unable to search hotels." });
    }

    const hotels = (result.properties ?? [])
      .map(mapHotelProperty)
      .filter(Boolean);

    const payload = {
      hotels,
      brands: result.brands ?? [],
      pagination: result.pagination ?? null,
      totalResults: result.search_information?.total_results,
    };
    setCachedSearchResult(cacheKey, payload);
    res.set("X-Search-Cache", "miss");
    return res.json(payload);
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Unable to search hotels.",
    });
  }
});

/********************************************************************************************/
/* PROFILE ROUTE */
/********************************************************************************************/

app.get("/profile", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.query.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { profile, error } = await getProfileByEmail(normalizedEmail);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ profile });
  } catch (err) {
    console.error("Profile lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/profile", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const phone = normalizeText(req.body.phone);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const updates = {
      phone,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    };

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .ilike("email", normalizedEmail)
      .select("email, phone, first_name, last_name, role")
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ profile });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/managers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, role")
      .in("role", ["manager", "admin"])
      .order("first_name", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const managers = (data ?? []).map((profile) => {
      const name = normalizeText(
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`,
      );

      return {
        email: profile.email,
        name: name || profile.email,
        role: profile.role,
      };
    });

    return res.json({ managers });
  } catch (err) {
    console.error("Manager lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

function toManagedUser(profile) {
  const name = normalizeText(
    `${profile.first_name ?? ""} ${profile.last_name ?? ""}`,
  );

  return {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    firstName: profile.first_name,
    lastName: profile.last_name,
    name: name || profile.email,
    role: profile.role ?? "employee",
  };
}

function toManagedUserFromAuthUser(authUser, profile) {
  if (profile) {
    return toManagedUser(profile);
  }

  return {
    id: authUser.id,
    email: authUser.email,
    phone: authUser.phone,
    firstName: "",
    lastName: "",
    name: authUser.email,
    role: "employee",
  };
}

async function listAllAuthUsers() {
  const users = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  return users;
}

function buildFallbackProfileFromAuthUser(authUser, role = "employee") {
  const email = normalizeEmail(authUser?.email);
  const localPart = email.split("@")[0] || "user";

  return {
    id: authUser.id,
    email,
    phone: authUser.phone ?? null,
    first_name: normalizeText(authUser.user_metadata?.first_name) || localPart,
    last_name: normalizeText(authUser.user_metadata?.last_name) || "Account",
    role,
  };
}

async function countAdmins() {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

app.get(
  "/admin/users",
  requireAuthenticatedUser,
  requireRoleManager,
  async (req, res) => {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, email, phone, first_name, last_name, role")
        .order("email", { ascending: true });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const authUsers = await listAllAuthUsers();
      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const profilesByEmail = new Map(
        (profiles ?? []).map((profile) => [normalizeEmail(profile.email), profile]),
      );
      const seenProfileIds = new Set();
      const mergedUsers = authUsers.map((authUser) => {
        const profile =
          profilesById.get(authUser.id) ??
          profilesByEmail.get(normalizeEmail(authUser.email));

        if (profile) {
          seenProfileIds.add(profile.id);
        }

        return toManagedUserFromAuthUser(authUser, profile);
      });

      (profiles ?? []).forEach((profile) => {
        if (!seenProfileIds.has(profile.id)) {
          mergedUsers.push(toManagedUser(profile));
        }
      });

      const visibleUsers = req.profile.role === "admin"
        ? mergedUsers
        : mergedUsers.filter((user) => user.role === "employee");

      visibleUsers.sort((first, second) =>
        normalizeEmail(first.email).localeCompare(normalizeEmail(second.email)),
      );

      res.set("Cache-Control", "no-store");
      return res.json({
        actorRole: req.profile.role,
        users: visibleUsers,
      });
    } catch (err) {
      console.error("Managed user lookup error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.patch(
  "/admin/users/:id/role",
  requireAuthenticatedUser,
  requireRoleManager,
  async (req, res) => {
    try {
      const nextRole = normalizeText(req.body.role).toLowerCase();

      if (!assignableRoles.has(nextRole)) {
        return res.status(400).json({ error: "Choose a valid role." });
      }

      let { data: targetProfile, error: targetError } = await supabase
        .from("profiles")
        .select("id, email, phone, first_name, last_name, role")
        .eq("id", req.params.id)
        .maybeSingle();

      if (targetError) {
        return res.status(400).json({ error: targetError.message });
      }

      const authUser = (await listAllAuthUsers()).find(
        (user) => user.id === req.params.id,
      );

      if (!targetProfile && authUser?.email) {
        const { data: profileByEmail, error: emailProfileError } = await supabase
          .from("profiles")
          .select("id, email, phone, first_name, last_name, role")
          .ilike("email", normalizeEmail(authUser.email))
          .maybeSingle();

        if (emailProfileError) {
          return res.status(400).json({ error: emailProfileError.message });
        }

        targetProfile = profileByEmail;
      }

      if (!targetProfile && !authUser) {
        return res.status(404).json({ error: "User not found." });
      }

      const actorRole = req.profile.role;
      const targetRole = targetProfile?.role ?? "employee";

      if (req.params.id === req.profile.id && targetRole === "admin" && nextRole !== "admin") {
        return res.status(400).json({ error: "You cannot remove your own admin access." });
      }

      if (actorRole === "manager") {
        const canPromoteToManager =
          nextRole === "manager" &&
          targetRole !== "manager" &&
          targetRole !== "admin";

        if (!canPromoteToManager) {
          return res.status(403).json({
            error: "Managers can only promote non-admin users to manager.",
          });
        }
      }

      if (targetRole === "admin" && nextRole !== "admin") {
        const adminCount = await countAdmins();

        if (adminCount <= 1) {
          return res.status(400).json({ error: "At least one admin is required." });
        }
      }

      const saveRoleQuery = targetProfile
        ? supabase
            .from("profiles")
            .update({ role: nextRole })
            .eq("id", targetProfile.id)
        : supabase
            .from("profiles")
            .insert(buildFallbackProfileFromAuthUser(authUser, nextRole));

      const { data: updatedProfile, error } = await saveRoleQuery
        .select("id, email, phone, first_name, last_name, role")
        .maybeSingle();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!updatedProfile) {
        return res.status(500).json({ error: "Unable to save user role." });
      }

      return res.json({ user: toManagedUser(updatedProfile) });
    } catch (err) {
      console.error("Managed user role update error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

/********************************************************************************************/
/* APPROVAL REQUEST ROUTES */
/********************************************************************************************/

app.get("/approval-requests", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    const { profile, error: profileError } = await getProfileByEmail(email);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const requests = (data ?? []).map(toApprovalRequest);
    const visibleRequests = isApprovalRole(profile.role)
      ? requests.filter((request) => isApprovalAssignedToApprover(request, profile))
      : requests.filter((request) => isApprovalOwnedByUser(request, profile));

    return res.json({ requests: visibleRequests });
  } catch (err) {
    console.error("Approval request lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/approval-requests", async (req, res) => {
  try {
    const row = {
      id: `approval-${Date.now()}`,
      ...toApprovalRow(req.body),
      created_at: new Date().toISOString(),
    };

    if (
      !row.submitted_by ||
      !row.from_location ||
      !row.to_location ||
      !row.travel_dates ||
      !row.room_requirement ||
      !row.approver_email ||
      row.travelers.length === 0
    ) {
      return res.status(400).json({ error: "Please complete all request fields" });
    }

    const { data, error } = await supabase
      .from("approval_requests")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ request: toApprovalRequest(data) });
  } catch (err) {
    console.error("Approval request creation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/approval-requests/:id", async (req, res) => {
  try {
    const actorEmail = normalizeEmail(req.body.actorEmail);
    const { profile, error: profileError } = await getProfileByEmail(actorEmail);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    if (!profile) {
      return res.status(403).json({ error: "Profile access is required" });
    }

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (existingRequestError) {
      return res.status(400).json({ error: existingRequestError.message });
    }

    const existingApproval = toApprovalRequest(existingRequest);
    const isAssignedApprover =
      isApprovalRole(profile.role) &&
      normalizeEmail(existingRequest.approver_email) === normalizeEmail(profile.email);
    const isRequesterCancelling =
      req.body.status === "Cancelled" && isApprovalOwnedByUser(existingApproval, profile);

    if (!isAssignedApprover && !isRequesterCancelling) {
      return res.status(403).json({ error: "This request is assigned to another approver" });
    }

    const updates = toApprovalUpdateRow(req.body, existingRequest);

    const { data, error } = await supabase
      .from("approval_requests")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ request: toApprovalRequest(data) });
  } catch (err) {
    console.error("Approval request update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* SIGNUP ROUTE */
/********************************************************************************************/

app.post("/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";

    // 1. Validate input early (fail fast)
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!trimmedPhone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // 2. Create auth user
    const { data, error } = await createAuthUser({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const userId = data.user?.id;

    if (!userId) {
      return res.status(500).json({ error: "User creation failed" });
    }

    // Remove a stale profile left behind when a test auth user was deleted manually.
    await supabase
      .from("profiles")
      .delete()
      .eq("email", normalizedEmail)
      .neq("id", userId);

    const role = resolveSignupRole(normalizedEmail);

    // 3. Insert profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email: normalizedEmail,
      phone: trimmedPhone,
      first_name: firstName,
      last_name: lastName,
      role,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: profileError.message });
    }

    // 4. Respond immediately after core work is done
    return res.status(201).json({
      message: "User created successfully",
      userId,
      role,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* LOGIN ROUTE */
/********************************************************************************************/

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    // Validate early
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { profile } = await getProfileByEmail(normalizedEmail);

    return res.json({
      message: "Login successful",
      session: data.session,
      user: data.user,
      profile,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const requestOrigin = req.get("origin");
    const frontendUrl =
      requestOrigin && (allowedOrigins.has(requestOrigin) || isAllowedLocalDevOrigin(requestOrigin))
        ? requestOrigin
        : process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectTo = `${frontendUrl.replace(/\/$/, "")}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const accessToken = normalizeText(req.body.accessToken);
    const newPassword = normalizeText(req.body.newPassword);

    if (!accessToken || !newPassword) {
      return res.status(400).json({ error: "Reset token and password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.id) {
      return res.status(400).json({ error: "This password reset link is invalid or expired." });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      { password: newPassword },
    );

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* START SERVER */
/********************************************************************************************/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
