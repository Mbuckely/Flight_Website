"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import {
  fetchApprovalRequests,
  saveApprovalRequestUpdate,
  type ApprovalRequest,
} from "@/lib/approval-requests";
import { getStoredUser, isApprover, refreshStoredUserProfile } from "@/lib/auth";
import {
  getTripStartDate,
  isRequestOwnedByUser,
  sortTripsByStartDate,
} from "@/lib/travel";

function TripCard({
  trip,
  statusLabel,
  onCancel,
}: {
  trip: ApprovalRequest;
  statusLabel: string;
  onCancel: (trip: ApprovalRequest) => void;
}) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            {statusLabel}
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900">
            {trip.title}
          </h2>
          <p className="mt-3 text-lg text-slate-600">{trip.route}</p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <span className="inline-flex rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            Approved
          </span>
          <button
            type="button"
            onClick={() => onCancel(trip)}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Cancel Trip
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Submitted By
          </p>
          <p className="mt-2 text-base font-medium text-slate-700">
            {trip.submittedBy}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Travel Dates
          </p>
          <p className="mt-2 text-base font-medium text-slate-700">
            {trip.travelDates}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Rooms
          </p>
          <p className="mt-2 text-base font-medium text-slate-700">
            {trip.roomRequirement}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Shared
          </p>
          <p className="mt-2 text-base font-medium text-slate-700">
            {trip.itineraryShared ? "Yes" : "No"}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 px-5 py-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Travelers
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {trip.travelers.map((traveler) => (
            <span
              key={traveler}
              className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
            >
              {traveler}
            </span>
          ))}
        </div>
        <p className="mt-5 leading-7 text-slate-600">{trip.reason}</p>
      </div>

      {(trip.bookingDetails?.flight ||
        trip.bookingDetails?.stay ||
        trip.bookingDetails?.requestedAddOns?.length) && (
        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Generated Itinerary
          </p>
          <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            {trip.bookingDetails.flight && (
              <p>
                <span className="font-semibold text-slate-900">Flight:</span>{" "}
                {trip.bookingDetails.flight.airline},{" "}
                {trip.bookingDetails.flight.from} to{" "}
                {trip.bookingDetails.flight.to},{" "}
                {trip.bookingDetails.flight.duration}, $
                {trip.bookingDetails.flight.price}
              </p>
            )}
            {trip.bookingDetails.stay && (
              <p>
                <span className="font-semibold text-slate-900">Stay:</span>{" "}
                {trip.bookingDetails.stay.name}, {trip.bookingDetails.stay.price}
              </p>
            )}
            {!!trip.bookingDetails.requestedAddOns?.length && (
              <p>
                <span className="font-semibold text-slate-900">Add-ons:</span>{" "}
                {trip.bookingDetails.requestedAddOns.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function TripsPage() {
  const [approvedTrips, setApprovedTrips] = useState<ApprovalRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);

  const syncTrips = async () => {
    const currentUser = await refreshStoredUserProfile();
    const approverView = isApprover();
    const visibleTrips = (await fetchApprovalRequests(currentUser?.email))
      .filter((request) => request.status === "Approved")
      .filter((request) =>
        approverView ? true : isRequestOwnedByUser(request, currentUser),
      );

    setCanApprove(approverView);
    setApprovedTrips(sortTripsByStartDate(visibleTrips));
  };

  useEffect(() => {
    window.addEventListener("approvalchange", syncTrips);
    window.addEventListener("authchange", syncTrips);
    window.addEventListener("focus", syncTrips);
    window.setTimeout(() => {
      void syncTrips();
    }, 0);

    return () => {
      window.removeEventListener("approvalchange", syncTrips);
      window.removeEventListener("authchange", syncTrips);
      window.removeEventListener("focus", syncTrips);
    };
  }, []);

  const handleCancelTrip = async (trip: ApprovalRequest) => {
    const currentUser = getStoredUser();

    await saveApprovalRequestUpdate(
      trip.id,
      {
        status: "Cancelled",
        itineraryShared: false,
      },
      currentUser?.email,
    );

    await syncTrips();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingTrips = approvedTrips.filter((trip) => {
    const startDate = getTripStartDate(trip);

    if (!startDate) {
      return true;
    }

    startDate.setHours(0, 0, 0, 0);
    return startDate >= today;
  });

  const previousTrips = approvedTrips.filter((trip) => {
    const startDate = getTripStartDate(trip);

    if (!startDate) {
      return false;
    }

    startDate.setHours(0, 0, 0, 0);
    return startDate < today;
  });

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Sidebar />
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            Trips
          </p>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">
            {canApprove
              ? "Approved itineraries across previous, current, and upcoming travel."
              : "Your approved itineraries, including upcoming and previous trips."}
          </h1>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Upcoming Trips
            </p>
            <div className="mt-6 grid gap-5">
              {upcomingTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  statusLabel="Itinerary Shared"
                  onCancel={handleCancelTrip}
                />
              ))}

              {upcomingTrips.length === 0 && (
                <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-slate-600 shadow-sm">
                  Upcoming approved itineraries will appear here.
                </section>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Previous Trips
            </p>
            <div className="mt-6 grid gap-5">
              {previousTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  statusLabel="Trip History"
                  onCancel={handleCancelTrip}
                />
              ))}

              {previousTrips.length === 0 && (
                <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-slate-600 shadow-sm">
                  Previous trip history will appear here after travel is completed.
                </section>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
