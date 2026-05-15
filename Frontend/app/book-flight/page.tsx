"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import AirportField from "@/components/flights/AirportField";
import FlightCard from "@/components/flights/FlightCard";
import GooglePlaceField from "@/components/places/GooglePlaceField";
import StaggeredReveal from "@/components/ui/StaggeredReveal";
import { getApiUrl } from "@/lib/api-url";
import { createApprovalRequest } from "@/lib/approval-requests";
import { getStoredUser, isLoggedIn } from "@/lib/auth";
import type { FlightOffer } from "@/lib/flights";
import type { HotelProperty, HotelSearchResponse } from "@/lib/hotels";

type SearchTab = "stays" | "flights";
type FlightTripType = "round_trip" | "one_way" | "multi_city";
type ManagerOption = {
  email: string;
  name: string;
  role: string;
};
type MultiCityLegState = {
  id: string;
  from: string;
  to: string;
  date: string;
};
type FlightSortOption =
  | "price_low_high"
  | "price_high_low"
  | "departure_early_late"
  | "departure_late_early"
  | "duration_short_long"
  | "duration_long_short";
type StaySortOption =
  | "recommended"
  | "price_low_high"
  | "price_high_low"
  | "rating_high_low"
  | "rating_low_high"
  | "most_reviewed";

const topTabs: { id: SearchTab; label: string }[] = [
  { id: "stays", label: "Stays" },
  { id: "flights", label: "Flights" },
];

const flightTripTypes: { id: FlightTripType; label: string }[] = [
  { id: "round_trip", label: "Roundtrip" },
  { id: "one_way", label: "One-way" },
  { id: "multi_city", label: "Multi-city" },
];

const flightSortOptions: { id: FlightSortOption; label: string }[] = [
  { id: "price_low_high", label: "Price: low to high" },
  { id: "price_high_low", label: "Price: high to low" },
  { id: "departure_early_late", label: "Time: earliest first" },
  { id: "departure_late_early", label: "Time: latest first" },
  { id: "duration_short_long", label: "Duration: shortest first" },
  { id: "duration_long_short", label: "Duration: longest first" },
];
const staySortOptions: { id: StaySortOption; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "price_low_high", label: "Price: low to high" },
  { id: "price_high_low", label: "Price: high to low" },
  { id: "rating_high_low", label: "Rating: best to worst" },
  { id: "rating_low_high", label: "Rating: worst to best" },
  { id: "most_reviewed", label: "Most reviewed" },
];
const PENDING_FLIGHT_SELECTION_KEY = "pendingFlightSelection";
const POPULAR_FLIGHTS_CACHE_KEY = "popularFlightResults";
const POPULAR_STAYS_CACHE_KEY = "popularStayResults";
const CLIENT_RESULTS_CACHE_TTL_MS = 10 * 60 * 1000;

const popularHotelDestinations = [
  "Hotels in New York",
  "Hotels in Miami",
  "Hotels in Chicago",
  "Hotels in Atlanta",
  "Hotels in Orlando",
];

type ClientResultsCache<T> = {
  expiresAt: number;
  results: T[];
};

const preferredAirlines = [
  "Delta",
  "American Airlines",
  "United Airlines",
  "Southwest",
  "JetBlue",
  "Alaska",
];

const corporateTools = [
  {
    title: "Policy-Friendly Options",
    description: "Highlight routes that fit company travel standards and budgets.",
  },
  {
    title: "Team Traveler Profiles",
    description: "Keep traveler details organized for faster repeat booking.",
  },
  {
    title: "Flexible Corporate Changes",
    description: "Focus on fares that are easier to adjust when plans move.",
  },
];

function SearchField({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
      <span className="text-slate-700">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
        />
      </span>
    </label>
  );
}

function formatSelectedDates(startDate: string, endDate: string) {
  const formatDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formattedStart = formatDate(startDate);
  const formattedEnd = formatDate(endDate);

  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`;
  }

  return formattedStart || formattedEnd;
}

function getDateOffset(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split("T")[0];
}

function getFlightDepartureValue(flight: FlightOffer) {
  const firstSegment = flight.segments[0];

  if (!firstSegment?.departureDate || !firstSegment.departureTime) {
    return 0;
  }

  const timestamp = new Date(
    `${firstSegment.departureDate}T${firstSegment.departureTime}`,
  ).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getFlightRequestRoute(flight: FlightOffer) {
  const firstSegment = flight.segments[0];
  const outboundArrivalSegment =
    flight.segments.find((segment) => segment.arrivalId === flight.to) ??
    flight.segments[flight.segments.length - 1];

  return {
    departure: firstSegment?.departureAirport || flight.from,
    arrival: outboundArrivalSegment?.arrivalAirport || flight.to,
  };
}

function sortFlights(flights: FlightOffer[], sortBy: FlightSortOption) {
  return [...flights].sort((first, second) => {
    switch (sortBy) {
      case "price_high_low":
        return second.price - first.price;
      case "departure_early_late":
        return getFlightDepartureValue(first) - getFlightDepartureValue(second);
      case "departure_late_early":
        return getFlightDepartureValue(second) - getFlightDepartureValue(first);
      case "duration_short_long":
        return (first.durationMinutes ?? 0) - (second.durationMinutes ?? 0);
      case "duration_long_short":
        return (second.durationMinutes ?? 0) - (first.durationMinutes ?? 0);
      case "price_low_high":
      default:
        return first.price - second.price;
    }
  });
}

function getStayApiSort(sortBy: StaySortOption) {
  switch (sortBy) {
    case "price_low_high":
      return "lowest_price";
    case "rating_high_low":
      return "highest_rating";
    case "most_reviewed":
      return "most_reviewed";
    case "recommended":
    case "price_high_low":
    case "rating_low_high":
    default:
      return "relevance";
  }
}

function getHotelPriceValue(hotel: HotelProperty) {
  return hotel.totalPriceValue ?? hotel.pricePerNightValue ?? Number.MAX_SAFE_INTEGER;
}

function sortHotels(hotels: HotelProperty[], sortBy: StaySortOption) {
  return [...hotels].sort((first, second) => {
    switch (sortBy) {
      case "price_low_high":
        return getHotelPriceValue(first) - getHotelPriceValue(second);
      case "price_high_low":
        return getHotelPriceValue(second) - getHotelPriceValue(first);
      case "rating_high_low":
        return (second.rating ?? 0) - (first.rating ?? 0);
      case "rating_low_high":
        return (first.rating ?? 0) - (second.rating ?? 0);
      case "most_reviewed":
        return (second.reviews ?? 0) - (first.reviews ?? 0);
      case "recommended":
      default:
        return 0;
    }
  });
}

function getHotelSummary(hotel: HotelProperty) {
  return [
    hotel.description,
    hotel.hotelClass,
    hotel.rating ? `${hotel.rating.toFixed(1)} rating` : "",
    hotel.city,
  ]
    .filter(Boolean)
    .join(" | ");
}

function getSessionCachedResults<T>(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = JSON.parse(
      window.sessionStorage.getItem(key) ?? "null",
    ) as ClientResultsCache<T> | null;

    if (!cached || cached.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return cached.results;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function setSessionCachedResults<T>(key: string, results: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({
      expiresAt: Date.now() + CLIENT_RESULTS_CACHE_TTL_MS,
      results,
    }),
  );
}

function createMultiCityLeg(index: number): MultiCityLegState {
  return {
    id: `leg-${Date.now()}-${index}`,
    from: "",
    to: "",
    date: "",
  };
}

function FeaturedFlightCard({
  flight,
  selected,
  onSelect,
}: {
  flight: FlightOffer;
  selected: boolean;
  onSelect: (flight: FlightOffer) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const firstSegment = flight.segments[0];
  const finalSegment = flight.segments[flight.segments.length - 1];

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg ${
        selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {flight.airlineLogo && (
            <Image
              src={flight.airlineLogo}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-contain"
              unoptimized
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">
              {flight.airline}
            </p>
            <p className="text-sm text-slate-500">
              {flight.stops === 0
                ? "Nonstop"
                : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            From
          </p>
          <p className="text-2xl font-bold text-blue-900">${flight.price}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-2xl font-bold text-slate-900">{flight.from}</p>
          <p className="text-sm text-slate-500">
            {firstSegment?.departureTime || "Depart"}
          </p>
        </div>
        <div className="flex min-w-[76px] flex-col items-center gap-2">
          <span className="h-px w-full bg-slate-300" />
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {flight.duration}
          </span>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{flight.to}</p>
          <p className="text-sm text-slate-500">
            {finalSegment?.arrivalTime || "Arrive"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">
          {flight.type}
        </span>
        {typeof flight.emissionsPercent === "number" && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">
            {flight.emissionsPercent > 0 ? "+" : ""}
            {flight.emissionsPercent}% emissions
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        aria-expanded={detailsOpen}
        className="mt-5 flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
      >
        <span>Flight details</span>
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
        />
      </button>

      {detailsOpen && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {flight.segments.map((segment, index) => (
            <div
              key={`${segment.flightNumber ?? segment.airline}-${index}`}
              className="rounded-xl bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">
                  {segment.flightNumber ?? segment.airline}
                </p>
                <p className="text-sm font-medium text-slate-500">
                  {segment.airplane ?? "Aircraft details unavailable"}
                </p>
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-[1fr_auto_1fr]">
                <div>
                  <p className="font-semibold text-slate-900">
                    {segment.departureTime} {segment.departureId}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {segment.departureAirport}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {segment.departureDate}
                  </p>
                </div>
                <p className="self-center whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {segment.durationMinutes
                    ? `${Math.floor(segment.durationMinutes / 60)}h ${segment.durationMinutes % 60}m`
                    : "Duration unavailable"}
                </p>
                <div className="md:text-right">
                  <p className="font-semibold text-slate-900">
                    {segment.arrivalTime} {segment.arrivalId}
                  </p>
                  <p className="mt-1 text-slate-600">
                    {segment.arrivalAirport}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {segment.arrivalDate}
                  </p>
                </div>
              </div>
              {segment.travelClass && (
                <p className="mt-3 text-sm text-slate-500">
                  Cabin: {segment.travelClass}
                </p>
              )}
            </div>
          ))}

          {flight.layovers.length > 0 && (
            <div className="rounded-xl bg-white p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                Layovers
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {flight.layovers.map((layover) => (
                  <span
                    key={layover}
                    className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800"
                  >
                    {layover}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4">
              <p className="text-slate-500">Total duration</p>
              <p className="mt-1 font-semibold text-slate-900">{flight.duration}</p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-slate-500">Stops</p>
              <p className="mt-1 font-semibold text-slate-900">
                {flight.stops === 0 ? "Nonstop" : flight.stops}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4">
              <p className="text-slate-500">Emissions</p>
              <p className="mt-1 font-semibold text-slate-900">
                {typeof flight.emissionsPercent === "number"
                  ? `${flight.emissionsPercent > 0 ? "+" : ""}${flight.emissionsPercent}%`
                  : "Unavailable"}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect(flight)}
        className={`mt-6 w-full rounded-xl px-4 py-3 font-semibold transition ${
          selected
            ? "bg-blue-700 text-white hover:bg-blue-800"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {selected ? "Selected" : "Select flight"}
      </button>
    </article>
  );
}

function HotelCard({
  hotel,
  selected,
  onSelect,
}: {
  hotel: HotelProperty;
  selected: boolean;
  onSelect: (hotel: HotelProperty) => void;
}) {
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:border-blue-300 hover:shadow-lg ${
        selected ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"
      }`}
    >
      <div className="grid gap-0 md:grid-cols-[260px_1fr_auto]">
        <div className="relative min-h-56 bg-slate-100 md:min-h-full">
          {hotel.image ? (
            <Image
              src={hotel.image}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 260px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full min-h-56 items-center justify-center text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Hotel
            </div>
          )}
        </div>

        <div className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            <span>{hotel.type === "vacation_rental" ? "Vacation rental" : "Hotel"}</span>
            {hotel.hotelClass && <span>{hotel.hotelClass}</span>}
          </div>
          <h3 className="mt-2 text-2xl font-bold text-slate-900">{hotel.name}</h3>
          <p className="mt-2 text-sm text-slate-500">
            {[hotel.city, hotel.country].filter(Boolean).join(", ")}
          </p>
          {hotel.description && (
            <p className="mt-3 max-w-3xl text-slate-600">{hotel.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {typeof hotel.rating === "number" && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                {hotel.rating.toFixed(1)} rating
                {typeof hotel.reviews === "number" ? ` (${hotel.reviews})` : ""}
              </span>
            )}
            {hotel.deal && (
              <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-800">
                {hotel.deal}
              </span>
            )}
            {hotel.amenities.slice(0, 4).map((amenity) => (
              <span
                key={amenity}
                className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700"
              >
                {amenity}
              </span>
            ))}
          </div>

          {hotel.nearbyPlaces.length > 0 && (
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              {hotel.nearbyPlaces.slice(0, 2).map((place) => (
                <p key={`${hotel.id}-${place.name}`}>
                  {place.name}
                  {place.transportation ? ` | ${place.transportation}` : ""}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 p-5 md:min-w-56 md:border-l md:border-t-0 md:text-right">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Total
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {hotel.totalPrice || hotel.pricePerNight}
          </p>
          {hotel.pricePerNight && (
            <p className="mt-1 text-sm text-slate-500">
              {hotel.pricePerNight} nightly
            </p>
          )}
          {hotel.priceBeforeTaxes && (
            <p className="mt-1 text-xs text-slate-400">
              {hotel.priceBeforeTaxes} before taxes
            </p>
          )}
          <button
            type="button"
            onClick={() => onSelect(hotel)}
            className={`mt-5 w-full rounded-xl px-5 py-2.5 font-semibold text-white transition ${
              selected
                ? "bg-blue-700 hover:bg-blue-800"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    </article>
  );
}

function BookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userFlightSearchStartedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<SearchTab>("flights");
  const [flightTripType, setFlightTripType] =
    useState<FlightTripType>("round_trip");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stayCheckInDate, setStayCheckInDate] = useState("");
  const [stayCheckOutDate, setStayCheckOutDate] = useState("");
  const [flightOutboundDate, setFlightOutboundDate] = useState("");
  const [flightReturnDate, setFlightReturnDate] = useState("");
  const [multiCityLegs, setMultiCityLegs] = useState<MultiCityLegState[]>([
    { id: "leg-1", from: "", to: "", date: "" },
    { id: "leg-2", from: "", to: "", date: "" },
  ]);
  const [stayAdults, setStayAdults] = useState(2);
  const [stayRooms, setStayRooms] = useState(1);
  const [staySort, setStaySort] = useState<StaySortOption>("recommended");
  const [stayMaxPrice, setStayMaxPrice] = useState("");
  const [stayRating, setStayRating] = useState("");
  const [stayFreeCancellation, setStayFreeCancellation] = useState(false);
  const [flightAdults, setFlightAdults] = useState(1);
  const [flightTravelClass, setFlightTravelClass] = useState("economy");
  const [flightStops, setFlightStops] = useState("any");
  const [flightSort, setFlightSort] =
    useState<FlightSortOption>("price_low_high");
  const [flightMaxPrice, setFlightMaxPrice] = useState("");
  const [addFlightToStay, setAddFlightToStay] = useState(false);
  const [addCarToStay, setAddCarToStay] = useState(false);
  const [addStayToFlight, setAddStayToFlight] = useState(false);
  const [addCarToFlight, setAddCarToFlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightOffer[]>([]);
  const [selectedOutboundFlight, setSelectedOutboundFlight] =
    useState<FlightOffer | null>(null);
  const [isSelectingReturnFlight, setIsSelectingReturnFlight] = useState(false);
  const [hasSearchedFlights, setHasSearchedFlights] = useState(false);
  const [initialFlightsLoading, setInitialFlightsLoading] = useState(true);
  const [showStayResults, setShowStayResults] = useState(false);
  const [stayResults, setStayResults] = useState<HotelProperty[]>([]);
  const [hasSearchedStays, setHasSearchedStays] = useState(false);
  const [stayLoading, setStayLoading] = useState(false);
  const [stayError, setStayError] = useState("");
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [selectedStay, setSelectedStay] = useState<HotelProperty | null>(null);
  const [requestNames, setRequestNames] = useState("");
  const [requestFrom, setRequestFrom] = useState("");
  const [requestTo, setRequestTo] = useState("");
  const [requestStartDate, setRequestStartDate] = useState("");
  const [requestEndDate, setRequestEndDate] = useState("");
  const [requestRooms, setRequestRooms] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [selectedApproverEmail, setSelectedApproverEmail] = useState("");
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [flightApprovalSubmitted, setFlightApprovalSubmitted] = useState(false);
  const [flightApprovalError, setFlightApprovalError] = useState("");
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [isSubmittingFlightApproval, setIsSubmittingFlightApproval] =
    useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [flightError, setFlightError] = useState("");
  const sortedFlightResults = useMemo(
    () => sortFlights(flightResults, flightSort),
    [flightResults, flightSort],
  );
  const sortedStayResults = useMemo(
    () => sortHotels(stayResults, staySort),
    [stayResults, staySort],
  );

  useEffect(() => {
    const tab = searchParams.get("tab");

    if (tab === "stays") {
      setActiveTab("stays");
      return;
    }

    setActiveTab("flights");
  }, [searchParams]);

  useEffect(() => {
    const syncLoggedInState = () => {
      setLoggedIn(isLoggedIn());
    };

    window.addEventListener("authchange", syncLoggedInState);
    window.addEventListener("focus", syncLoggedInState);
    syncLoggedInState();

    return () => {
      window.removeEventListener("authchange", syncLoggedInState);
      window.removeEventListener("focus", syncLoggedInState);
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || typeof window === "undefined") {
      return;
    }

    const pendingFlightSelection = window.sessionStorage.getItem(
      PENDING_FLIGHT_SELECTION_KEY,
    );

    if (!pendingFlightSelection) {
      return;
    }

    try {
      const flight = JSON.parse(pendingFlightSelection) as FlightOffer;
      const route = getFlightRequestRoute(flight);

      setSelectedFlight(flight);
      setRequestFrom(route.departure);
      setRequestTo(route.arrival);
      setFlightResults((current) =>
        current.some((offer) => offer.id === flight.id)
          ? current
          : [flight, ...current],
      );
      setActiveTab("flights");
    } catch {
      // Ignore malformed saved selection.
    } finally {
      window.sessionStorage.removeItem(PENDING_FLIGHT_SELECTION_KEY);
    }
  }, [loggedIn]);

  useEffect(() => {
    const loadManagers = async () => {
      try {
        const response = await fetch(`${getApiUrl()}/managers`);
        const result = (await response.json()) as {
          managers?: ManagerOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load approvers");
        }

        setManagers(result.managers ?? []);
      } catch {
        setManagers([]);
      }
    };

    if (loggedIn) {
      void loadManagers();
    }
  }, [loggedIn]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialFlights = async () => {
      const query = new URLSearchParams({
        departure_id: "JFK",
        arrival_id: "LAX",
        outbound_date: getDateOffset(14),
        flight_type: "one_way",
        travel_class: "economy",
        stops: "any",
        adults: "1",
      });
      const cacheKey = `${POPULAR_FLIGHTS_CACHE_KEY}:${query.toString()}`;
      const cachedFlights = getSessionCachedResults<FlightOffer>(cacheKey);

      if (cachedFlights?.length) {
        setFlightResults(cachedFlights);
        setInitialFlightsLoading(false);
      } else {
        setInitialFlightsLoading(true);
      }

      try {
        const response = await fetch(`/api/flights?${query.toString()}`);
        const result = (await response.json()) as {
          flights?: FlightOffer[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load live flight options.");
        }

        if (!cancelled && !userFlightSearchStartedRef.current) {
          const nextFlights = (result.flights ?? []).slice(0, 6);
          setFlightResults(nextFlights);
          setSessionCachedResults(cacheKey, nextFlights);
        }
      } catch {
        if (!cancelled) {
          setFlightResults([]);
        }
      } finally {
        if (!cancelled) {
          setInitialFlightsLoading(false);
        }
      }
    };

    void loadInitialFlights();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPopularStays = async () => {
      setShowStayResults(true);
      const query = new URLSearchParams({
        q: popularHotelDestinations[0],
        check_in_date: getDateOffset(14),
        check_out_date: getDateOffset(15),
        adults: "2",
        sort_by: "relevance",
        property_type: "hotel",
      });
      const cacheKey = `${POPULAR_STAYS_CACHE_KEY}:${query.toString()}`;
      const cachedStays = getSessionCachedResults<HotelProperty>(cacheKey);

      if (cachedStays?.length) {
        setStayResults(cachedStays);
        setStayLoading(false);
      } else {
        setStayLoading(true);
      }

      try {
        const response = await fetch(`/api/hotels?${query.toString()}`);
        const result = (await response.json()) as HotelSearchResponse;

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load popular hotels.");
        }

        if (!cancelled) {
          const nextStays = result.hotels ?? [];
          setStayResults(nextStays);
          setSessionCachedResults(cacheKey, nextStays);
        }
      } catch {
        if (!cancelled) {
          setStayResults([]);
        }
      } finally {
        if (!cancelled) {
          setStayLoading(false);
        }
      }
    };

    void loadPopularStays();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleFlightSearch = async () => {
    setFlightError("");
    setFlightResults([]);
    setSelectedFlight(null);
    setSelectedOutboundFlight(null);
    setIsSelectingReturnFlight(false);
    setFlightApprovalSubmitted(false);
    setFlightApprovalError("");
    setHasSearchedFlights(false);
    userFlightSearchStartedRef.current = true;

    setLoading(true);
    setShowStayResults(false);

    try {
      const query = new URLSearchParams({
        flight_type: flightTripType,
        travel_class: flightTravelClass,
        stops: flightStops,
        adults: String(flightAdults),
      });

      if (flightTripType === "multi_city") {
        query.set(
          "multi_city_json",
          JSON.stringify(
            multiCityLegs.map((leg) => ({
              departure_id: leg.from,
              arrival_id: leg.to,
              outbound_date: leg.date,
            })),
          ),
        );
      } else {
        query.set("departure_id", from);
        query.set("arrival_id", to);
        query.set("outbound_date", flightOutboundDate);
      }

      if (flightTripType === "round_trip") {
        query.set("return_date", flightReturnDate);
      }

      if (flightMaxPrice.trim()) {
        query.set("max_price", flightMaxPrice.trim());
      }

      const response = await fetch(`/api/flights?${query.toString()}`);
      const result = (await response.json()) as {
        flights?: FlightOffer[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to search flights.");
      }

      setFlightResults(result.flights ?? []);
      setHasSearchedFlights(true);
    } catch (error) {
      setHasSearchedFlights(true);
      setFlightError(
        error instanceof Error
          ? error.message
          : "Unable to search flights right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStaySearch = async (destinationOverride?: string) => {
    const destination = destinationOverride ?? location;
    const checkInDate = stayCheckInDate || getDateOffset(14);
    const checkOutDate = stayCheckOutDate || getDateOffset(15);

    setStayError("");
    setStayResults([]);
    setSelectedStay(null);
    setRequestSubmitted(false);

    setFlightResults([]);
    setShowStayResults(true);
    setStayLoading(true);

    try {
      const query = new URLSearchParams({
        q: destination || popularHotelDestinations[0],
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        adults: String(stayAdults),
        sort_by: getStayApiSort(staySort),
        property_type: "hotel",
      });

      if (stayMaxPrice.trim()) {
        query.set("price_max", stayMaxPrice.trim());
      }

      if (stayRating) {
        query.set("rating", stayRating);
      }

      if (stayFreeCancellation) {
        query.set("free_cancellation", "true");
      }

      const response = await fetch(`/api/hotels?${query.toString()}`);
      const result = (await response.json()) as HotelSearchResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to search hotels.");
      }

      setStayResults(result.hotels ?? []);
      setHasSearchedStays(Boolean(destinationOverride || location.trim()));
    } catch (error) {
      setStayError(
        error instanceof Error
          ? error.message
          : "Unable to search hotels right now.",
      );
    } finally {
      setStayLoading(false);
    }
  };

  const handlePopularDestinationSelect = (destination: string) => {
    setLocation(destination);
    void handleStaySearch(destination);
  };

  const handleTravelRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequestSubmitted(false);
    setRequestError("");

    const parsedTravelers = requestNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    const selectedApprover = managers.find(
      (manager) => manager.email === selectedApproverEmail,
    );
    const travelDates = formatSelectedDates(requestStartDate, requestEndDate);

    if (
      !requestNames.trim() ||
      !requestFrom.trim() ||
      !requestTo.trim() ||
      !requestStartDate ||
      !requestEndDate ||
      !requestRooms.trim() ||
      !selectedApprover
    ) {
      setRequestError("Please complete all request fields before sending.");
      return;
    }

    const storedUser = getStoredUser();
    const submittedBy = storedUser
      ? storedUser.name ?? storedUser.email ?? "Travel Coordinator"
      : "Travel Coordinator";

    setIsSubmittingRequest(true);

    try {
      await createApprovalRequest({
        submittedBy,
        approverEmail: selectedApprover.email,
        approverName: selectedApprover.name,
        travelers: parsedTravelers,
        fromLocation: requestFrom,
        toLocation: requestTo,
        travelDates,
        roomRequirement: requestRooms,
        bookingDetails: {
          ...(selectedFlight
            ? {
                flight: {
                  airline: selectedFlight.airline,
                  from: selectedFlight.from,
                  to: selectedFlight.to,
                  duration: selectedFlight.duration,
                  price: selectedFlight.price,
                },
              }
            : {}),
          ...(selectedStay
            ? {
                stay: {
                  name: selectedStay.name,
                  details: getHotelSummary(selectedStay),
                  price: selectedStay.totalPrice || selectedStay.pricePerNight,
                  priceValue: selectedStay.totalPriceValue,
                  pricePerNight: selectedStay.pricePerNight,
                  checkInTime: selectedStay.checkInTime,
                  checkOutTime: selectedStay.checkOutTime,
                  rating: selectedStay.rating,
                },
              }
            : {}),
          requestedAddOns: [
            ...(addFlightToStay || addStayToFlight ? ["Flight"] : []),
            ...(addCarToStay || addCarToFlight ? ["Car"] : []),
            ...(addStayToFlight || selectedStay ? ["Stay"] : []),
          ],
        },
        reason: requestReason || "Employee-submitted travel request awaiting review.",
      });

      setRequestSubmitted(true);
      setRequestNames("");
      setRequestFrom("");
      setRequestTo("");
      setRequestStartDate("");
      setRequestEndDate("");
      setRequestRooms("");
      setSelectedApproverEmail("");
      setSelectedFlight(null);
      setSelectedStay(null);
      setRequestReason("");
    } catch (err) {
      setRequestError(
        err instanceof Error
          ? err.message
          : "Unable to send this request for approval.",
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const combineRoundTripFlights = (
    outboundFlight: FlightOffer,
    returnFlight: FlightOffer,
  ): FlightOffer => ({
    ...returnFlight,
    id: `${outboundFlight.id}-${returnFlight.id}`,
    airline:
      outboundFlight.airline === returnFlight.airline
        ? outboundFlight.airline
        : `${outboundFlight.airline}, ${returnFlight.airline}`,
    airlineLogo: outboundFlight.airlineLogo ?? returnFlight.airlineLogo,
    from: outboundFlight.from,
    to: outboundFlight.to,
    type: "Round trip",
    stops: outboundFlight.stops + returnFlight.stops,
    layovers: [...outboundFlight.layovers, ...returnFlight.layovers],
    segments: [...outboundFlight.segments, ...returnFlight.segments],
    durationMinutes:
      (outboundFlight.durationMinutes ?? 0) +
      (returnFlight.durationMinutes ?? 0),
    duration: `${outboundFlight.duration} outbound + ${returnFlight.duration} return`,
  });

  const loadReturnFlights = async (outboundFlight: FlightOffer) => {
    if (!outboundFlight.departureToken) {
      setSelectedFlight(outboundFlight);
      return;
    }

    setLoading(true);
    setFlightError("");
    setSelectedOutboundFlight(outboundFlight);
    setIsSelectingReturnFlight(true);

    try {
      const query = new URLSearchParams({
        departure_id: from,
        arrival_id: to,
        outbound_date: flightOutboundDate,
        return_date: flightReturnDate,
        flight_type: "round_trip",
        travel_class: flightTravelClass,
        stops: flightStops,
        adults: String(flightAdults),
        departure_token: outboundFlight.departureToken,
      });

      if (flightMaxPrice.trim()) {
        query.set("max_price", flightMaxPrice.trim());
      }

      const response = await fetch(`/api/flights?${query.toString()}`);
      const result = (await response.json()) as {
        flights?: FlightOffer[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load return flights.");
      }

      setFlightResults(result.flights ?? []);
    } catch (error) {
      setIsSelectingReturnFlight(false);
      setFlightError(
        error instanceof Error
          ? error.message
          : "Unable to load return flights right now.",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateMultiCityLeg = (
    id: string,
    field: keyof Omit<MultiCityLegState, "id">,
    value: string,
  ) => {
    setMultiCityLegs((current) =>
      current.map((leg) => (leg.id === id ? { ...leg, [field]: value } : leg)),
    );
  };

  const addMultiCityLeg = () => {
    setMultiCityLegs((current) => [
      ...current,
      createMultiCityLeg(current.length + 1),
    ]);
  };

  const removeMultiCityLeg = (id: string) => {
    setMultiCityLegs((current) =>
      current.length <= 2 ? current : current.filter((leg) => leg.id !== id),
    );
  };

  const setRequestFieldIfEmpty = (
    currentValue: string,
    setter: (value: string) => void,
    nextValue?: string,
  ) => {
    const normalizedValue = nextValue?.trim();

    if (!currentValue.trim() && normalizedValue) {
      setter(normalizedValue);
    }
  };

  const getDateInputValue = (value?: string) => {
    if (!value) {
      return "";
    }

    const isoDate = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];

    if (isoDate) {
      return isoDate;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toISOString().split("T")[0];
  };

  const populateRequestFromFlight = (
    flight: FlightOffer,
    options: { overwriteRoute?: boolean } = {},
  ) => {
    const firstSegment = flight.segments[0];
    const finalSegment = flight.segments[flight.segments.length - 1];
    const route = getFlightRequestRoute(flight);

    if (options.overwriteRoute) {
      setRequestFrom(route.departure);
      setRequestTo(route.arrival);
    } else {
      setRequestFieldIfEmpty(requestFrom, setRequestFrom, route.departure);
      setRequestFieldIfEmpty(requestTo, setRequestTo, route.arrival);
    }

    setRequestFieldIfEmpty(
      requestStartDate,
      setRequestStartDate,
      getDateInputValue(firstSegment?.departureDate),
    );
    setRequestFieldIfEmpty(
      requestEndDate,
      setRequestEndDate,
      getDateInputValue(finalSegment?.arrivalDate || firstSegment?.departureDate),
    );
  };

  const populateRequestFromStay = (hotel: HotelProperty) => {
    setRequestFieldIfEmpty(requestTo, setRequestTo, hotel.city || location);
    setRequestFieldIfEmpty(requestStartDate, setRequestStartDate, stayCheckInDate);
    setRequestFieldIfEmpty(requestEndDate, setRequestEndDate, stayCheckOutDate);
    setRequestFieldIfEmpty(
      requestRooms,
      setRequestRooms,
      `${stayRooms} room${stayRooms === 1 ? "" : "s"}`,
    );

    if (selectedFlight) {
      populateRequestFromFlight(selectedFlight);
    }
  };

  const handleAddFlightToStayToggle = () => {
    setAddFlightToStay((current) => {
      const next = !current;

      if (next && selectedStay && !selectedFlight) {
        setActiveTab("flights");
      }

      return next;
    });
  };

  const handleAddStayToFlightToggle = () => {
    setAddStayToFlight((current) => {
      const next = !current;

      if (next && selectedFlight && !selectedStay) {
        setShowStayResults(true);
        setActiveTab("stays");
      }

      return next;
    });
  };

  const handleFlightSelect = (flight: FlightOffer) => {
    if (
      flightTripType === "round_trip" &&
      hasSearchedFlights &&
      !isSelectingReturnFlight &&
      flight.departureToken
    ) {
      void loadReturnFlights(flight);
      return;
    }

    const completedFlight =
      isSelectingReturnFlight && selectedOutboundFlight
        ? combineRoundTripFlights(selectedOutboundFlight, flight)
        : flight;

    setSelectedFlight(completedFlight);
    setIsSelectingReturnFlight(false);
    populateRequestFromFlight(completedFlight, { overwriteRoute: true });

    if (addStayToFlight && !selectedStay) {
      setShowStayResults(true);
      setActiveTab("stays");
    }
  };

  const handleStaySelect = (hotel: HotelProperty) => {
    setSelectedStay(hotel);
    populateRequestFromStay(hotel);

    if (addFlightToStay && !selectedFlight) {
      setActiveTab("flights");
    }
  };

  const handleFlightApprovalSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFlightApprovalSubmitted(false);
    setFlightApprovalError("");

    const currentUser = getStoredUser();
    const selectedApprover = managers.find(
      (manager) => manager.email === selectedApproverEmail,
    );

    if (!selectedFlight) {
      setFlightApprovalError("Select a flight before sending it for approval.");
      return;
    }

    if (!currentUser) {
      router.push(`/login?returnTo=${encodeURIComponent("/book-flight")}`);
      return;
    }

    if (!selectedApprover) {
      setFlightApprovalError("Choose a manager before sending this flight.");
      return;
    }

    const firstSegment = selectedFlight.segments[0];
    const finalSegment =
      selectedFlight.segments[selectedFlight.segments.length - 1];
    const submittedBy =
      currentUser.name ?? currentUser.email ?? "Travel Coordinator";
    const travelDates = [
      firstSegment?.departureDate,
      finalSegment?.arrivalDate,
    ]
      .filter(Boolean)
      .join(" - ");

    setIsSubmittingFlightApproval(true);

    try {
      await createApprovalRequest({
        submittedBy,
        approverEmail: selectedApprover.email,
        approverName: selectedApprover.name,
        travelers: [submittedBy],
        fromLocation: selectedFlight.from,
        toLocation: selectedFlight.to,
        travelDates: travelDates || "Flight dates selected",
        roomRequirement: "Flight only",
        bookingDetails: {
          flight: {
            airline: selectedFlight.airline,
            from: selectedFlight.from,
            to: selectedFlight.to,
            duration: selectedFlight.duration,
            price: selectedFlight.price,
          },
          requestedAddOns: [
            ...(addStayToFlight ? ["Stay"] : []),
            ...(addCarToFlight ? ["Car"] : []),
          ],
        },
        reason:
          requestReason ||
          "Employee-selected flight itinerary submitted for manager approval.",
      });

      setFlightApprovalSubmitted(true);
      setFlightApprovalError("");
      setRequestReason("");
    } catch (error) {
      setFlightApprovalError(
        error instanceof Error
          ? error.message
          : "Unable to send this flight to your manager.",
      );
    } finally {
      setIsSubmittingFlightApproval(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 pt-4">
            <div className="flex flex-wrap justify-center gap-8">
              {topTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`border-b-2 px-2 pb-4 text-lg font-semibold transition ${
                    activeTab === tab.id
                      ? "border-blue-700 text-blue-700"
                      : "border-transparent text-slate-700 hover:text-blue-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === "stays" && (
              <section className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr_0.8fr_0.55fr_0.45fr_auto]">
                  <GooglePlaceField
                    icon={<MapPinIcon className="h-6 w-6" />}
                    label="Where to?"
                    value={location}
                    onChange={setLocation}
                    placeholder="City, hotel, or airport"
                  />
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <span className="text-slate-700">
                      <CalendarDaysIcon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Check in
                      </span>
                      <input
                        type="date"
                        value={stayCheckInDate}
                        onChange={(event) => setStayCheckInDate(event.target.value)}
                        className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                      />
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <span className="text-slate-700">
                      <CalendarDaysIcon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Check out
                      </span>
                      <input
                        type="date"
                        value={stayCheckOutDate}
                        min={stayCheckInDate || undefined}
                        onChange={(event) => setStayCheckOutDate(event.target.value)}
                        className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                      />
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <span className="text-slate-700">
                      <UserIcon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Guests
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="6"
                        value={stayAdults}
                        onChange={(event) => setStayAdults(Number(event.target.value))}
                        className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                      />
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Rooms
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="9"
                        value={stayRooms}
                        onChange={(event) => setStayRooms(Number(event.target.value))}
                        className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                      />
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleStaySearch()}
                    disabled={stayLoading}
                    className="rounded-2xl bg-blue-700 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                  >
                    {stayLoading ? "Searching..." : "Search"}
                  </button>
                </div>

                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Sort
                      </span>
                      <select
                        value={staySort}
                        onChange={(event) =>
                          setStaySort(event.target.value as StaySortOption)
                        }
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      >
                        {staySortOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Max price
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={stayMaxPrice}
                        onChange={(event) => setStayMaxPrice(event.target.value)}
                        placeholder="No limit"
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Rating
                      </span>
                      <select
                        value={stayRating}
                        onChange={(event) => setStayRating(event.target.value)}
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      >
                        <option value="">Any</option>
                        <option value="7">3.5+</option>
                        <option value="8">4.0+</option>
                        <option value="9">4.5+</option>
                      </select>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={stayFreeCancellation}
                      onChange={() => setStayFreeCancellation((value) => !value)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Free cancellation
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {popularHotelDestinations.map((destination) => (
                    <button
                      key={destination}
                      type="button"
                      onClick={() => handlePopularDestinationSelect(destination)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {destination.replace("Hotels in ", "")}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-6 text-lg text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addFlightToStay}
                      onChange={handleAddFlightToStayToggle}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    Add a flight
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addCarToStay}
                      onChange={() => setAddCarToStay((value) => !value)}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    Add a car
                  </label>
                </div>

                {loggedIn ? (
                  <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
                    <div className="max-w-3xl">
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                        Request Travel
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                        Submit a trip request for approval
                      </h3>
                      <p className="mt-3 text-slate-600">
                        Add the basics here and send it into the approvals flow.
                        Approvers can adjust the itinerary before confirming it.
                      </p>
                    </div>

                    <form
                      onSubmit={handleTravelRequestSubmit}
                      className="mt-6 grid gap-4"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <SearchField
                          icon={<UserIcon className="h-6 w-6" />}
                          label="Traveler names"
                          value={requestNames}
                          onChange={setRequestNames}
                          placeholder="Jordan Lee, Avery Patel"
                        />
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                          <span className="text-slate-700">
                            <UserIcon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Approver
                            </span>
                            <select
                              value={selectedApproverEmail}
                              onChange={(event) =>
                                setSelectedApproverEmail(event.target.value)
                              }
                              className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                            >
                              <option value="">Select an approver</option>
                              {managers.map((manager) => (
                                <option key={manager.email} value={manager.email}>
                                  {manager.name}
                                </option>
                              ))}
                            </select>
                          </span>
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                          <span className="text-slate-700">
                            <CalendarDaysIcon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Start date
                            </span>
                            <input
                              type="date"
                              value={requestStartDate}
                              onChange={(event) =>
                                setRequestStartDate(event.target.value)
                              }
                              className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                            />
                          </span>
                        </label>
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                          <span className="text-slate-700">
                            <CalendarDaysIcon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              End date
                            </span>
                            <input
                              type="date"
                              value={requestEndDate}
                              min={requestStartDate || undefined}
                              onChange={(event) =>
                                setRequestEndDate(event.target.value)
                              }
                              className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                            />
                          </span>
                        </label>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <GooglePlaceField
                          icon={<MapPinIcon className="h-6 w-6" />}
                          label="Leaving from"
                          value={requestFrom}
                          onChange={setRequestFrom}
                          placeholder="Chicago"
                        />
                        <GooglePlaceField
                          icon={<MapPinIcon className="h-6 w-6" />}
                          label="Going to"
                          value={requestTo}
                          onChange={setRequestTo}
                          placeholder="New York"
                        />
                        <SearchField
                          icon={<UserIcon className="h-6 w-6" />}
                          label="Rooms needed"
                          value={requestRooms}
                          onChange={setRequestRooms}
                          placeholder="2 rooms"
                        />
                      </div>

                      {(selectedFlight || selectedStay) && (
                        <div className="grid gap-3 rounded-2xl border border-blue-200 bg-white p-4 text-sm text-slate-700 md:grid-cols-2">
                          {selectedFlight && (
                            <div>
                              <p className="font-semibold text-blue-700">
                                Selected flight
                              </p>
                              <p className="mt-1">
                                {selectedFlight.airline}: {selectedFlight.from} to{" "}
                                {selectedFlight.to}, {selectedFlight.duration},{" "}
                                ${selectedFlight.price}
                              </p>
                            </div>
                          )}
                          {selectedStay && (
                            <div>
                              <p className="font-semibold text-blue-700">
                                Selected stay
                              </p>
                              <p className="mt-1">
                                {selectedStay.name}:{" "}
                                {selectedStay.totalPrice || selectedStay.pricePerNight}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <label className="grid gap-2">
                        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Notes
                        </span>
                        <textarea
                          value={requestReason}
                          onChange={(event) => setRequestReason(event.target.value)}
                          placeholder="Add any details the approver should review."
                          rows={4}
                          className="resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="submit"
                          disabled={isSubmittingRequest}
                          className="rounded-2xl bg-blue-900 px-6 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {isSubmittingRequest ? "Sending..." : "Send for approval"}
                        </button>

                        {requestSubmitted && (
                          <p className="text-sm font-medium text-green-700">
                            Travel request submitted to approvals.
                          </p>
                        )}
                        {requestError && (
                          <p className="text-sm font-medium text-red-600">
                            {requestError}
                          </p>
                        )}
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-6">
                    <Link
                      href="/login"
                      className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700 transition hover:text-blue-900 hover:underline"
                    >
                      Sign In Required
                    </Link>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                      Log in to submit your trip request
                    </h3>
                  </div>
                )}
              </section>
            )}

            {activeTab === "flights" && (
              <section className="space-y-6">
                <div className="flex flex-wrap gap-8 text-lg font-semibold">
                  {flightTripTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFlightTripType(type.id)}
                      className={`border-b-2 pb-2 transition ${
                        flightTripType === type.id
                          ? "border-blue-700 text-blue-700"
                          : "border-transparent text-slate-700 hover:text-blue-700"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {flightTripType === "multi_city" ? (
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {multiCityLegs.map((leg, index) => (
                      <div
                        key={leg.id}
                        className="grid gap-4 rounded-2xl bg-white p-4 shadow-sm xl:grid-cols-[0.25fr_1fr_1fr_0.8fr_auto]"
                      >
                        <div className="flex items-center">
                          <span className="rounded-full bg-blue-900 px-3 py-1 text-sm font-bold text-white">
                            Leg {index + 1}
                          </span>
                        </div>
                        <AirportField
                          icon={<MapPinIcon className="h-6 w-6" />}
                          label="Leaving from"
                          value={leg.from}
                          onChange={(value) =>
                            updateMultiCityLeg(leg.id, "from", value)
                          }
                          placeholder="Try MCO, Orlando"
                        />
                        <AirportField
                          icon={<MapPinIcon className="h-6 w-6" />}
                          label="Going to"
                          value={leg.to}
                          onChange={(value) =>
                            updateMultiCityLeg(leg.id, "to", value)
                          }
                          placeholder="Try ATL, Atlanta"
                        />
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                          <span className="text-slate-700">
                            <CalendarDaysIcon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Depart
                            </span>
                            <input
                              type="date"
                              value={leg.date}
                              onChange={(event) =>
                                updateMultiCityLeg(
                                  leg.id,
                                  "date",
                                  event.target.value,
                                )
                              }
                              className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                            />
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeMultiCityLeg(leg.id)}
                          disabled={multiCityLegs.length <= 2}
                          className="flex h-full min-h-[76px] items-center justify-center rounded-2xl border border-slate-200 px-4 text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Remove leg ${index + 1}`}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={addMultiCityLeg}
                        className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 font-semibold text-blue-800 transition hover:bg-blue-50"
                      >
                        <PlusIcon className="h-5 w-5" />
                        Add another city
                      </button>
                      <button
                        type="button"
                        onClick={handleFlightSearch}
                        disabled={loading}
                        className="rounded-2xl bg-blue-700 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                      >
                        {loading ? "Searching..." : "Search"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_0.8fr_0.8fr_auto]">
                    <AirportField
                      icon={<MapPinIcon className="h-6 w-6" />}
                      label="Leaving from"
                      value={from}
                      onChange={setFrom}
                      placeholder="Try JFK, Houston, Chicago"
                    />
                    <AirportField
                      icon={<MapPinIcon className="h-6 w-6" />}
                      label="Going to"
                      value={to}
                      onChange={setTo}
                      placeholder="Try LAX, Miami, Seattle"
                    />
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                      <span className="text-slate-700">
                        <CalendarDaysIcon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Depart
                        </span>
                        <input
                          type="date"
                          value={flightOutboundDate}
                          onChange={(event) =>
                            setFlightOutboundDate(event.target.value)
                          }
                          className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                        />
                      </span>
                    </label>
                    {flightTripType === "round_trip" ? (
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                        <span className="text-slate-700">
                          <CalendarDaysIcon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Return
                          </span>
                          <input
                            type="date"
                            value={flightReturnDate}
                            min={flightOutboundDate || undefined}
                            onChange={(event) =>
                              setFlightReturnDate(event.target.value)
                            }
                            className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                          />
                        </span>
                      </label>
                    ) : (
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                        <span className="text-slate-700">
                          <UserIcon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Travelers
                          </span>
                          <input
                            type="number"
                            min="1"
                            max="9"
                            value={flightAdults}
                            onChange={(event) =>
                              setFlightAdults(Number(event.target.value))
                            }
                            className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                          />
                        </span>
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={handleFlightSearch}
                      disabled={loading}
                      className="rounded-2xl bg-blue-700 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                    >
                      {loading ? "Searching..." : "Search"}
                    </button>
                  </div>
                )}

                {flightTripType !== "one_way" && (
                  <div className="grid gap-4 md:max-w-sm">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                      <span className="text-slate-700">
                        <UserIcon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Travelers
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="9"
                          value={flightAdults}
                          onChange={(event) =>
                            setFlightAdults(Number(event.target.value))
                          }
                          className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                        />
                      </span>
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap gap-6 text-lg text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addStayToFlight}
                      onChange={handleAddStayToFlightToggle}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    Add a place to stay
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addCarToFlight}
                      onChange={() => setAddCarToFlight((value) => !value)}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    Add a car
                  </label>
                </div>

                {flightError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                    {flightError}
                  </div>
                )}
              </section>
            )}

          </div>
        </div>

        <section className="mt-10 space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                  Preferred Carriers
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Popular airlines for business travel
                </h2>
              </div>
              <p className="max-w-2xl text-slate-600">
                Keep familiar airline choices visible so employees can book faster
                and stay within preferred travel patterns.
              </p>
            </div>

            <StaggeredReveal
              className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6"
              baseDelayMs={120}
              stepDelayMs={220}
            >
              {preferredAirlines.map((airline) => (
                <div key={airline}>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-white">
                    {airline}
                  </div>
                </div>
              ))}
            </StaggeredReveal>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {corporateTools.map((tool) => (
              <article
                key={tool.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Corporate Booking
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-slate-900">
                  {tool.title}
                </h3>
                <p className="mt-3 leading-7 text-slate-600">{tool.description}</p>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                {isSelectingReturnFlight ? "Return Options" : "Search Results"}
              </p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">
                {isSelectingReturnFlight
                  ? "Choose your return flight"
                  : activeTab === "stays"
                  ? "Stay options"
                  : hasSearchedFlights
                    ? "Flight options"
                    : "Live flight options"}
              </h2>
            </div>

            {activeTab === "flights" && (
              <div className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 lg:max-w-4xl">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Cabin
                      </span>
                      <select
                        value={flightTravelClass}
                        onChange={(event) =>
                          setFlightTravelClass(event.target.value)
                        }
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      >
                        <option value="economy">Economy</option>
                        <option value="premium_economy">Premium economy</option>
                        <option value="business">Business</option>
                        <option value="first_class">First class</option>
                      </select>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Sort
                      </span>
                      <select
                        value={flightSort}
                        onChange={(event) =>
                          setFlightSort(event.target.value as FlightSortOption)
                        }
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      >
                        {flightSortOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Stops
                      </span>
                      <select
                        value={flightStops}
                        onChange={(event) => setFlightStops(event.target.value)}
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                      >
                        <option value="any">Any</option>
                        <option value="nonstop">Nonstop</option>
                        <option value="one_stop_or_fewer">1 stop or fewer</option>
                        <option value="two_stops_or_fewer">2 stops or fewer</option>
                      </select>
                    </span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Max price
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={flightMaxPrice}
                        onChange={(event) => setFlightMaxPrice(event.target.value)}
                        placeholder="No limit"
                        className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </span>
                  </label>
                </div>
            )}
          </div>

          {activeTab === "stays" && showStayResults && (
            <div className="grid gap-5">
              {!stayLoading && !stayError && sortedStayResults.length > 0 && (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                    {hasSearchedStays ? "Stay Options" : "Popular Stays"}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    {hasSearchedStays
                      ? `Hotels and motels for ${location || "your destination"}`
                      : "Popular hotel picks"}
                  </h2>
                </div>
              )}
              {stayLoading ? (
                <div className="rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
                  Loading live hotel options...
                </div>
              ) : stayError ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700 shadow-sm">
                  {stayError}
                </div>
              ) : sortedStayResults.length > 0 ? (
                sortedStayResults.map((stay) => (
                  <HotelCard
                    key={stay.id}
                    hotel={stay}
                    selected={selectedStay?.id === stay.id}
                    onSelect={handleStaySelect}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-700">
                  No hotel options came back for {location || "that destination"}.
                  Try different dates, filters, or a nearby city.
                </div>
              )}
            </div>
          )}

          {activeTab === "flights" && (
            <div className="grid gap-5">
              {selectedOutboundFlight && isSelectingReturnFlight && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-800">
                  Departing flight selected: {selectedOutboundFlight.airline},{" "}
                  {selectedOutboundFlight.from} to {selectedOutboundFlight.to}.
                  Choose a return flight to complete the trip.
                </div>
              )}

              {loading || initialFlightsLoading ? (
                <div className="rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
                  Loading live flight options...
                </div>
              ) : sortedFlightResults.length > 0 ? (
                hasSearchedFlights ? (
                  sortedFlightResults.map((offer) => (
                    <FlightCard
                      key={offer.id}
                      flight={offer}
                      selected={selectedFlight?.id === offer.id}
                      onSelect={handleFlightSelect}
                    />
                  ))
                ) : (
                  <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                          Live Picks
                        </p>
                        <h3 className="mt-2 text-2xl font-bold text-slate-900">
                          Popular flights
                        </h3>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                      {sortedFlightResults.slice(0, 6).map((offer) => (
                        <FeaturedFlightCard
                          key={offer.id}
                          flight={offer}
                          selected={selectedFlight?.id === offer.id}
                          onSelect={handleFlightSelect}
                        />
                      ))}
                    </div>
                  </section>
                )
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-700">
                  {hasSearchedFlights
                    ? `No flight options came back for ${from || "your departure city"} to ${to || "your destination"}. Try another date, airport, or stop filter.`
                    : "Live flight options could not load. Enter a route above and search to try again."}
                </div>
              )}

              {selectedFlight && (
                <section className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                        Selected Itinerary
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900">
                        {selectedFlight.airline}: {selectedFlight.from} to{" "}
                        {selectedFlight.to}
                      </h3>
                      <p className="mt-2 text-slate-600">
                        {selectedFlight.type} | {selectedFlight.duration} | $
                        {selectedFlight.price}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFlight(null)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Change selection
                    </button>
                  </div>

                  {loggedIn && getStoredUser()?.role === "employee" ? (
                    <form
                      onSubmit={handleFlightApprovalSubmit}
                      className="mt-6 grid gap-4"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
                          <span className="text-slate-700">
                            <UserIcon className="h-6 w-6" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              Manager
                            </span>
                            <select
                              value={selectedApproverEmail}
                              onChange={(event) =>
                                setSelectedApproverEmail(event.target.value)
                              }
                              className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none"
                            >
                              <option value="">Select a manager</option>
                              {managers.map((manager) => (
                                <option key={manager.email} value={manager.email}>
                                  {manager.name}
                                </option>
                              ))}
                            </select>
                          </span>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Notes
                          </span>
                          <textarea
                            value={requestReason}
                            onChange={(event) =>
                              setRequestReason(event.target.value)
                            }
                            placeholder="Add anything your manager should review."
                            rows={3}
                            className="resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="submit"
                          disabled={isSubmittingFlightApproval}
                          className="rounded-2xl bg-blue-900 px-6 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                        >
                          {isSubmittingFlightApproval
                            ? "Sending..."
                            : "Send to manager"}
                        </button>
                        {flightApprovalSubmitted && (
                          <p className="text-sm font-medium text-green-700">
                            Flight sent to your manager for approval.
                          </p>
                        )}
                        {flightApprovalError && (
                          <p className="text-sm font-medium text-red-600">
                            {flightApprovalError}
                          </p>
                        )}
                      </div>
                    </form>
                  ) : loggedIn ? (
                    <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
                      This itinerary is selected. Manager approval submission is
                      shown for employee accounts.
                    </p>
                  ) : null}
                </section>
              )}
            </div>
          )}

          {activeTab === "stays" && !showStayResults && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
              Enter a destination, check-in date, and check-out date to see live hotel options.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 px-6 py-12">
          <div className="mx-auto max-w-7xl rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
            Loading booking options...
          </div>
        </main>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
