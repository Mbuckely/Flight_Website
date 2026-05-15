"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CountUp from "react-countup";
import Sidebar from "@/components/layout/Sidebar";
import {
  fetchApprovalRequests,
  type ApprovalRequest,
} from "@/lib/approval-requests";
import {
  fetchApprovalAnalytics,
  type ApprovalAnalyticsRange,
  type ApprovalAnalyticsResponse,
} from "@/lib/approval-analytics";
import { getStoredUser, refreshStoredUserProfile, type UserRole } from "@/lib/auth";
import {
  getTripStartDate,
  isRequestOwnedByUser,
  sortTripsByStartDate,
} from "@/lib/travel";

function getUpcomingTrips(trips: ApprovalRequest[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return trips.filter((trip) => {
    const startDate = getTripStartDate(trip);

    if (!startDate) {
      return true;
    }

    startDate.setHours(0, 0, 0, 0);
    return startDate >= today;
  });
}

function getPreviousTrips(trips: ApprovalRequest[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return trips.filter((trip) => {
    const startDate = getTripStartDate(trip);

    if (!startDate) {
      return false;
    }

    startDate.setHours(0, 0, 0, 0);
    return startDate < today;
  });
}

function getRequestSpend(request: ApprovalRequest) {
  const flightSpend = request.bookingDetails?.flight?.price ?? 0;
  const staySpend =
    request.bookingDetails?.stay?.priceValue ??
    Number(
      request.bookingDetails?.stay?.price
        ?.replace(/[^0-9.]/g, "")
        .trim() || 0,
    );

  return flightSpend + staySpend;
}

export default function DashboardPage() {
  const router = useRouter();
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [userName, setUserName] = useState("Traveler");
  const [userRole, setUserRole] = useState<UserRole>("employee");
  const [analyticsRange, setAnalyticsRange] =
    useState<ApprovalAnalyticsRange>("month");
  const [managerFilter, setManagerFilter] = useState("");
  const [approvalAnalytics, setApprovalAnalytics] =
    useState<ApprovalAnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");

  useEffect(() => {
    const user = localStorage.getItem("user");

    if (!user) {
      router.push("/login");
    }

    const syncDashboard = async () => {
      const currentUser = await refreshStoredUserProfile();
      const role = currentUser?.role;
      const canUserApprove = role === "approver" || role === "manager" || role === "admin";

      setCanApprove(canUserApprove);
      setUserRole(role ?? "employee");
      setUserName(
        currentUser?.name?.trim() ||
          currentUser?.email?.split("@")[0] ||
          "Traveler",
      );

      if (!currentUser) {
        router.push("/login");
        return;
      }

      const requests = await fetchApprovalRequests(currentUser.email);
      setApprovalRequests(requests);

      if (role === "manager" || role === "admin") {
        try {
          const analytics = await fetchApprovalAnalytics(
            analyticsRange,
            role === "admin" ? managerFilter : undefined,
          );
          setApprovalAnalytics(analytics);
          setAnalyticsError("");
        } catch (error) {
          setApprovalAnalytics(null);
          setAnalyticsError(
            error instanceof Error
              ? error.message
              : "Unable to load approval analytics.",
          );
        }
      } else {
        setApprovalAnalytics(null);
      }
    };

    window.addEventListener("approvalchange", syncDashboard);
    window.addEventListener("authchange", syncDashboard);
    window.addEventListener("focus", syncDashboard);
    syncDashboard();

    return () => {
      window.removeEventListener("approvalchange", syncDashboard);
      window.removeEventListener("authchange", syncDashboard);
      window.removeEventListener("focus", syncDashboard);
    };
  }, [router, analyticsRange, managerFilter]);

  const pendingApprovals = approvalRequests.filter(
    (request) => request.status !== "Approved",
  );
  const approvedTrips = approvalRequests.filter(
    (request) => request.status === "Approved",
  );
  const changesRequested = approvalRequests.filter(
    (request) => request.status === "Changes Requested",
  );
  const approvedSpend = approvedTrips.reduce(
    (total, request) => total + getRequestSpend(request),
    0,
  );
  const closedRequests = approvalRequests.filter((request) =>
    ["Approved", "Changes Requested", "Cancelled"].includes(request.status),
  );
  const complianceRate =
    closedRequests.length > 0
      ? Math.round((approvedTrips.length / closedRequests.length) * 100)
      : 0;
  const visibleTrips = canApprove
    ? sortTripsByStartDate(approvedTrips)
    : sortTripsByStartDate(
        approvedTrips.filter((request) =>
          isRequestOwnedByUser(request, getStoredUser()),
        ),
      );
  const upcomingTrips = getUpcomingTrips(visibleTrips);
  const previousTrips = getPreviousTrips(visibleTrips);
  const canViewApprovalAnalytics =
    userRole === "manager" || userRole === "admin";
  const analyticsSpend = approvalAnalytics?.totalSpend ?? 0;
  const analyticsApprovedCount = approvalAnalytics?.approvedCount ?? 0;
  const analyticsAverageTripCost = approvalAnalytics?.averageTripCost ?? 0;
  const largestManagerSpend = Math.max(
    ...((approvalAnalytics?.managerTotals ?? []).map(
      (manager) => manager.totalSpend,
    )),
    1,
  );

  const approverSummaryCards = [
    {
      label: "Active Trips",
      value: visibleTrips.length,
      note: "Approved trips currently visible to your team",
    },
    {
      label: "Pending Approvals",
      value: pendingApprovals.length,
      note: "Open requests currently waiting for review",
    },
    {
      label: "Approved Spend",
      value: analyticsSpend || approvedSpend,
      prefix: "$",
      separator: ",",
      note: approvalAnalytics
        ? `Approved trip spend for this ${analyticsRange}`
        : "Based on approved flight and hotel selections",
    },
    {
      label: "Traveler Compliance",
      value: complianceRate,
      suffix: "%",
      note: closedRequests.length
        ? "Approved requests out of closed requests"
        : "No closed requests to calculate yet",
    },
  ];

  const employeeSummaryCards = [
    {
      label: "Upcoming Trips",
      value: upcomingTrips.length,
      note: "Your next approved trips",
    },
    {
      label: "Previous Trips",
      value: previousTrips.length,
      note: "Trips already completed",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <Sidebar />

        {canApprove ? (
          <section className="space-y-8">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {approverSummaryCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {card.label}
                  </p>
                  <p className="mt-4 text-4xl font-bold text-slate-900">
                    <CountUp
                      end={card.value}
                      duration={1.8}
                      separator={card.separator}
                      prefix={card.prefix}
                      suffix={card.suffix}
                    />
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {card.note}
                  </p>
                </article>
              ))}
            </div>

            {canViewApprovalAnalytics && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Approval Analytics
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    Approved trip spend by period
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-slate-600">
                    {userRole === "admin"
                      ? "Admins can see all manager approvals and filter down to one manager."
                      : "Managers only see the trips they approved."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Period
                    </span>
                    <select
                      value={analyticsRange}
                      onChange={(event) =>
                        setAnalyticsRange(
                          event.target.value as ApprovalAnalyticsRange,
                        )
                      }
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
                    >
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="quarter">This quarter</option>
                    </select>
                  </label>

                  {userRole === "admin" && (
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Manager
                      </span>
                      <select
                        value={managerFilter}
                        onChange={(event) => setManagerFilter(event.target.value)}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500"
                      >
                        <option value="">All managers</option>
                        {(approvalAnalytics?.managerOptions ?? []).map(
                          (manager) => (
                            <option key={manager.email} value={manager.email}>
                              {manager.name}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                </div>
              </div>

              {analyticsError && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {analyticsError}
                </div>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Approved Spend
                  </p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    $
                    <CountUp
                      end={analyticsSpend}
                      duration={1.4}
                      separator=","
                      decimals={analyticsSpend % 1 ? 2 : 0}
                    />
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Approved Trips
                  </p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    <CountUp end={analyticsApprovedCount} duration={1.4} />
                  </p>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Average Trip Cost
                  </p>
                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    $
                    <CountUp
                      end={analyticsAverageTripCost}
                      duration={1.4}
                      separator=","
                      decimals={analyticsAverageTripCost % 1 ? 2 : 0}
                    />
                  </p>
                </article>
              </div>

              <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Spend Visual
                  </p>
                  <div className="mt-5 grid gap-4">
                    {(approvalAnalytics?.managerTotals ?? []).map((manager) => (
                      <div key={manager.email} className="grid gap-2">
                        <div className="flex items-center justify-between gap-4 text-sm">
                          <span className="font-semibold text-slate-900">
                            {manager.name}
                          </span>
                          <span className="font-semibold text-slate-700">
                            ${manager.totalSpend.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-700"
                            style={{
                              width: `${Math.max(
                                (manager.totalSpend / largestManagerSpend) * 100,
                                manager.totalSpend ? 8 : 0,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}

                    {(approvalAnalytics?.managerTotals ?? []).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                        No approved trip spend is recorded for this period yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Recent Approved Trips
                  </p>
                  <div className="mt-5 grid gap-3">
                    {(approvalAnalytics?.trips ?? []).slice(0, 4).map((trip) => (
                      <article
                        key={trip.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {trip.title}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {trip.route}
                            </p>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {trip.approvedByName}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900">
                            ${trip.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      </article>
                    ))}

                    {(approvalAnalytics?.trips ?? []).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                        Approved trips will appear here once a request is approved.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
            )}

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Upcoming Travel
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-900">
                      Trips that need visibility this week
                    </h2>
                  </div>
                  <Link
                    href="/trips"
                    className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                  >
                    View all trips
                  </Link>
                </div>

                <div className="mt-8 grid gap-4">
                  {visibleTrips.slice(0, 3).map((trip) => (
                    <div
                      key={trip.id}
                      className="rounded-2xl border border-slate-200 px-5 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {trip.travelers.join(", ")}
                          </p>
                          <p className="mt-1 text-slate-700">{trip.route}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {trip.travelDates}
                          </p>
                        </div>
                        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                          {trip.status}
                        </span>
                      </div>
                    </div>
                  ))}

                  {visibleTrips.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                      No approved team trips are visible yet.
                    </div>
                  )}
                </div>
              </section>

              <div className="grid gap-6">
                <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                        Approval Queue
                      </p>
                      <h2 className="mt-2 text-3xl font-bold text-slate-900">
                        Requests waiting on action
                      </h2>
                    </div>
                    <Link
                      href="/approvals"
                      className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                    >
                      Open approvals
                    </Link>
                  </div>

                  <div className="mt-8 grid gap-3">
                    {pendingApprovals.map((approval) => (
                      <details
                        key={approval.id}
                        className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {approval.title}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {approval.route}
                            </p>
                          </div>
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                            {approval.status}
                          </span>
                        </summary>

                        <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 text-sm text-slate-700">
                          <div className="grid gap-2 md:grid-cols-2">
                            <p>
                              <span className="font-semibold text-slate-900">
                                Submitted by:
                              </span>{" "}
                              {approval.submittedBy}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">
                                Dates:
                              </span>{" "}
                              {approval.travelDates}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">
                                Room needed:
                              </span>{" "}
                              {approval.roomRequirement}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900">
                                Travelers:
                              </span>{" "}
                              {approval.travelers.join(", ")}
                            </p>
                          </div>
                          <p className="leading-7 text-slate-600">
                            {approval.reason}
                          </p>
                        </div>
                      </details>
                    ))}

                    {pendingApprovals.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                        No approvals are waiting right now.
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[2rem] bg-blue-900 p-8 text-white shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                    Booking Operations
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    Keep travelers moving without losing oversight.
                  </h2>
                  <p className="mt-4 text-lg leading-8 text-blue-100">
                    Use the booking workspace to search policy-aligned flights,
                    monitor team movement, and act on approvals before they slow
                    down the trip.
                  </p>
                  <Link
                    href="/book-flight"
                    className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-semibold text-blue-900 transition hover:bg-slate-100"
                  >
                    Open Booking Workspace
                  </Link>
                </section>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-8">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                Employee Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-bold text-slate-900">
                Your travel in one place, {userName}.
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                View your upcoming trips, revisit previous travel, and jump
                straight into booking flights or stays when you need a new trip.
              </p>
            </section>

            {changesRequested.length > 0 && (
              <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Changes Requested
                </p>
                <div className="mt-4 grid gap-3">
                  {changesRequested.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-2xl bg-white px-5 py-4 text-slate-700"
                    >
                      <p className="font-semibold text-slate-900">
                        {request.title}
                      </p>
                      <p className="mt-1 text-sm">
                        Your approver requested changes for {request.route}. Open
                        the request details before resubmitting.
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              {employeeSummaryCards.map((card) => (
                <article
                  key={card.label}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {card.label}
                  </p>
                  <p className="mt-4 text-4xl font-bold text-slate-900">
                    <CountUp end={card.value} duration={1.8} />
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {card.note}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Upcoming Trips
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-900">
                      Your next approved travel
                    </h2>
                  </div>
                  <Link
                    href="/trips"
                    className="text-sm font-semibold text-blue-700 transition hover:text-blue-900"
                  >
                    View trips
                  </Link>
                </div>

                <div className="mt-8 grid gap-4">
                  {upcomingTrips.slice(0, 3).map((trip) => (
                    <article
                      key={trip.id}
                      className="rounded-2xl border border-slate-200 px-5 py-4"
                    >
                      <p className="font-semibold text-slate-900">{trip.title}</p>
                      <p className="mt-1 text-slate-700">{trip.route}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {trip.travelDates}
                      </p>
                      {(trip.bookingDetails?.flight ||
                        trip.bookingDetails?.stay) && (
                        <p className="mt-2 text-sm font-medium text-green-700">
                          Approved itinerary ready
                        </p>
                      )}
                    </article>
                  ))}

                  {upcomingTrips.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
                      You do not have any upcoming approved trips yet.
                    </div>
                  )}
                </div>
              </section>

              <div className="grid gap-6">
                <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Quick Actions
                  </p>
                  <h2 className="mt-2 text-3xl font-bold text-slate-900">
                    Book and manage your travel
                  </h2>
                  <div className="mt-8 grid gap-3">
                    <Link
                      href="/book-flight"
                      className="rounded-2xl border border-slate-200 px-5 py-4 font-semibold text-slate-900 transition hover:border-blue-300 hover:text-blue-700"
                    >
                      Book Flight
                    </Link>
                    <Link
                      href="/book-flight?tab=stays"
                      className="rounded-2xl border border-slate-200 px-5 py-4 font-semibold text-slate-900 transition hover:border-blue-300 hover:text-blue-700"
                    >
                      Book Stay
                    </Link>
                    <Link
                      href="/trips"
                      className="rounded-2xl border border-slate-200 px-5 py-4 font-semibold text-slate-900 transition hover:border-blue-300 hover:text-blue-700"
                    >
                      View Trips
                    </Link>
                  </div>
                </section>

                <section className="rounded-[2rem] bg-blue-900 p-8 text-white shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                    Previous Trips
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">
                    See where you have already traveled.
                  </h2>
                  <div className="mt-6 space-y-3">
                    {previousTrips.slice(0, 2).map((trip) => (
                      <div
                        key={trip.id}
                        className="rounded-2xl bg-white/10 px-5 py-4"
                      >
                        <p className="font-semibold">{trip.title}</p>
                        <p className="mt-1 text-sm text-blue-100">{trip.route}</p>
                        <p className="mt-1 text-sm text-blue-100">
                          {trip.travelDates}
                        </p>
                      </div>
                    ))}

                    {previousTrips.length === 0 && (
                      <p className="text-blue-100">
                        Your completed trip history will appear here.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
