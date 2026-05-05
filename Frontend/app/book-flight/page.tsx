"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDaysIcon,
  MapPinIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import FlightCard from "@/components/flights/FlightCard";
import GooglePlaceField from "@/components/places/GooglePlaceField";
import StaggeredReveal from "@/components/ui/StaggeredReveal";
import { createApprovalRequest } from "@/lib/approval-requests";
import { getStoredUser, isLoggedIn } from "@/lib/auth";
import type { FlightOffer } from "@/lib/amadeus";

type SearchTab = "stays" | "flights";
type FlightTripType = "roundtrip" | "one-way" | "multi-city";
type ManagerOption = {
  email: string;
  name: string;
  role: string;
};
type StayOption = {
  id: string;
  name: string;
  details: string;
  price: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

const topTabs: { id: SearchTab; label: string }[] = [
  { id: "stays", label: "Stays" },
  { id: "flights", label: "Flights" },
];

const flightTripTypes: { id: FlightTripType; label: string }[] = [
  { id: "roundtrip", label: "Roundtrip" },
  { id: "one-way", label: "One-way" },
  { id: "multi-city", label: "Multi-city" },
];

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

const stayResults = [
  {
    id: "stay-1",
    name: "RideTego Business Suites",
    details: "Downtown access, breakfast included, ideal for corporate teams.",
    price: "$189/night",
  },
  {
    id: "stay-2",
    name: "Executive Airport Hotel",
    details: "Five minutes from the airport with shuttle service and workspace.",
    price: "$214/night",
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

export default function BookingPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SearchTab>("flights");
  const [flightTripType, setFlightTripType] =
    useState<FlightTripType>("roundtrip");
  const [location, setLocation] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dates, setDates] = useState("");
  const [travelers, setTravelers] = useState("");
  const [addFlightToStay, setAddFlightToStay] = useState(false);
  const [addCarToStay, setAddCarToStay] = useState(false);
  const [addStayToFlight, setAddStayToFlight] = useState(false);
  const [addCarToFlight, setAddCarToFlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flightResults, setFlightResults] = useState<FlightOffer[]>([]);
  const [showStayResults, setShowStayResults] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [selectedStay, setSelectedStay] = useState<StayOption | null>(null);
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
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

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
    const loadManagers = async () => {
      try {
        const response = await fetch(`${API_URL.replace(/\/$/, "")}/managers`);
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

  const handleFlightSearch = async () => {
    setLoading(true);
    setShowStayResults(false);

    try {
      const query = new URLSearchParams({
        from,
        to,
      });

      const response = await fetch(`/api/flights?${query.toString()}`);
      const offers: FlightOffer[] = await response.json();
      setFlightResults(offers);
    } finally {
      setLoading(false);
    }
  };

  const handleStaySearch = () => {
    setFlightResults([]);
    setShowStayResults(true);
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
                  details: selectedStay.details,
                  price: selectedStay.price,
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
                <div className="grid gap-4 xl:grid-cols-[1.2fr_1.2fr_1.2fr_auto]">
                  <GooglePlaceField
                    icon={<MapPinIcon className="h-6 w-6" />}
                    label="Where to?"
                    value={location}
                    onChange={setLocation}
                    placeholder="City, hotel, or airport"
                  />
                  <SearchField
                    icon={<CalendarDaysIcon className="h-6 w-6" />}
                    label="Dates"
                    value={dates}
                    onChange={setDates}
                    placeholder="Tue, Apr 14 - Mon, Apr 20"
                  />
                  <SearchField
                    icon={<UserIcon className="h-6 w-6" />}
                    label="Travelers"
                    value={travelers}
                    onChange={setTravelers}
                    placeholder="2 travelers, 1 room"
                  />
                  <button
                    type="button"
                    onClick={handleStaySearch}
                    className="rounded-2xl bg-blue-700 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-800"
                  >
                    Search
                  </button>
                </div>

                <div className="flex flex-wrap gap-6 text-lg text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addFlightToStay}
                      onChange={() => setAddFlightToStay((value) => !value)}
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
                                {selectedStay.name}: {selectedStay.price}
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

                <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_0.9fr_auto]">
                  <GooglePlaceField
                    icon={<MapPinIcon className="h-6 w-6" />}
                    label="Leaving from"
                    value={from}
                    onChange={setFrom}
                    placeholder="Houston, TX (IAH)"
                  />
                  <GooglePlaceField
                    icon={<MapPinIcon className="h-6 w-6" />}
                    label="Going to"
                    value={to}
                    onChange={setTo}
                    placeholder="New York, NY (JFK)"
                  />
                  <SearchField
                    icon={<CalendarDaysIcon className="h-6 w-6" />}
                    label="Dates"
                    value={dates}
                    onChange={setDates}
                    placeholder="Mon, Apr 27 - Mon, May 4"
                  />
                  <SearchField
                    icon={<UserIcon className="h-6 w-6" />}
                    label="Travelers, Cabin class"
                    value={travelers}
                    onChange={setTravelers}
                    placeholder="1 traveler, Economy"
                  />
                  <button
                    type="button"
                    onClick={handleFlightSearch}
                    className="rounded-2xl bg-blue-700 px-8 py-4 text-lg font-semibold text-white transition hover:bg-blue-800"
                  >
                    Search
                  </button>
                </div>

                <div className="flex flex-wrap gap-6 text-lg text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addStayToFlight}
                      onChange={() => setAddStayToFlight((value) => !value)}
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

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
              Search Results
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">
              {activeTab === "stays" ? "Stay options" : "Flight options"}
            </h2>
          </div>

          {activeTab === "stays" && showStayResults && (
            <div className="grid gap-5">
              {stayResults.map((stay) => (
                <article
                  key={stay.id}
                  className={`rounded-3xl bg-white p-6 shadow-sm ${
                    selectedStay?.id === stay.id ? "ring-2 ring-blue-700" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold text-slate-900">
                        {stay.name}
                      </h3>
                      <p className="mt-3 max-w-2xl text-slate-600">
                        {stay.details}
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-2xl font-bold text-blue-900">
                        {stay.price}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedStay(stay)}
                        className="mt-3 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800"
                      >
                        {selectedStay?.id === stay.id ? "Selected" : "Select stay"}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeTab === "flights" && (
            <div className="grid gap-5">
              {loading ? (
                <div className="rounded-3xl bg-white p-8 text-slate-600 shadow-sm">
                  Loading flight offers...
                </div>
              ) : flightResults.length > 0 ? (
                flightResults.map((offer) => (
                  <FlightCard
                    key={offer.id}
                    flight={offer}
                    selected={selectedFlight?.id === offer.id}
                    onSelect={setSelectedFlight}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
                  Search flights to see options for {from || "your departure city"} to{" "}
                  {to || "your destination"}.
                </div>
              )}
            </div>
          )}

          {activeTab === "stays" && !showStayResults && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
              Enter a destination, dates, and travelers to see stay options.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
