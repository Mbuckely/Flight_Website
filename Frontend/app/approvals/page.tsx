"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import {
  fetchApprovalRequests,
  saveApprovalRequestUpdate,
  type ApprovalRequest,
} from "@/lib/approval-requests";
import { getStoredUser, isApprover } from "@/lib/auth";

function toTravelerString(travelers: string[]) {
  return travelers.join(", ");
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [savedApprovalId, setSavedApprovalId] = useState<string | null>(null);

  useEffect(() => {
    const syncAccess = () => {
      const currentUser = getStoredUser();

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setHasAccess(isApprover());
      setIsReady(true);
    };

    const syncApprovals = async () => {
      const currentUser = getStoredUser();
      setApprovals(await fetchApprovalRequests(currentUser?.email));
    };

    window.addEventListener("authchange", syncAccess);
    window.addEventListener("approvalchange", syncApprovals);
    window.addEventListener("focus", syncApprovals);
    window.addEventListener("focus", syncAccess);
    syncAccess();
    syncApprovals();

    return () => {
      window.removeEventListener("authchange", syncAccess);
      window.removeEventListener("approvalchange", syncApprovals);
      window.removeEventListener("focus", syncApprovals);
      window.removeEventListener("focus", syncAccess);
    };
  }, [router]);

  if (!isReady) {
    return null;
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-6xl space-y-8">
          <Sidebar />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
              Approvals
            </p>
            <h1 className="mt-4 text-4xl font-bold text-slate-900">
              Approval access is limited to approver accounts.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Employees can submit trip requests, but they cannot open or approve
              items in the request queue.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const handleFieldChange = (
    id: string,
    field:
      | "title"
      | "fromLocation"
      | "toLocation"
      | "travelDates"
      | "roomRequirement"
      | "reason",
    value: string,
  ) => {
    setApprovals((current) =>
      current.map((approval) =>
        approval.id === id ? { ...approval, [field]: value } : approval,
      ),
    );
  };

  const handleTravelerChange = (id: string, value: string) => {
    const travelers = value
      .split(",")
      .map((traveler) => traveler.trim())
      .filter(Boolean);

    setApprovals((current) =>
      current.map((approval) =>
        approval.id === id ? { ...approval, travelers } : approval,
      ),
    );
  };

  const handleSave = async (approval: ApprovalRequest) => {
    const currentUser = getStoredUser();
    const nextApprovals = await saveApprovalRequestUpdate(
      approval.id,
      approval,
      currentUser?.email,
    );
    setApprovals(nextApprovals);
    setSavedApprovalId(approval.id);
    window.setTimeout(() => {
      setSavedApprovalId((current) =>
        current === approval.id ? null : current,
      );
    }, 2000);
  };

  const handleStatusChange = (
    approval: ApprovalRequest,
    status: ApprovalRequest["status"],
  ) => {
    const currentUser = getStoredUser();
    void saveApprovalRequestUpdate(
      approval.id,
      {
        ...approval,
        status,
        itineraryShared: status === "Approved",
      },
      currentUser?.email,
    ).then(setApprovals);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Sidebar />

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            Approvals
          </p>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">
            Review travel requests waiting on approval.
          </h1>
        </section>

        <section className="grid gap-5">
          {approvals.map((approval) => (
            <article
              key={approval.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                    {approval.status}
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-slate-900">
                    {approval.title}
                  </h2>
                  <p className="mt-3 text-lg text-slate-600">
                    {approval.route}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleSave(approval)}
                    className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => handleStatusChange(approval, "Approved")}
                    className="rounded-2xl bg-blue-900 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      handleStatusChange(approval, "Changes Requested")
                    }
                    className="rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Request Changes
                  </button>
                </div>
              </div>

              {savedApprovalId === approval.id && (
                <p className="mt-4 text-sm font-medium text-green-700">
                  Changes saved.
                </p>
              )}

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Trip title
                  </span>
                  <input
                    value={approval.title}
                    onChange={(event) =>
                      handleFieldChange(approval.id, "title", event.target.value)
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Submitted by
                  </span>
                  <input
                    value={approval.submittedBy}
                    readOnly
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Approver
                  </span>
                  <input
                    value={
                      approval.approverName ??
                      approval.approverEmail ??
                      "Unassigned"
                    }
                    readOnly
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Leaving from
                  </span>
                  <input
                    value={approval.fromLocation}
                    onChange={(event) =>
                      handleFieldChange(
                        approval.id,
                        "fromLocation",
                        event.target.value,
                      )
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Going to
                  </span>
                  <input
                    value={approval.toLocation}
                    onChange={(event) =>
                      handleFieldChange(
                        approval.id,
                        "toLocation",
                        event.target.value,
                      )
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Travel dates
                  </span>
                  <input
                    value={approval.travelDates}
                    onChange={(event) =>
                      handleFieldChange(
                        approval.id,
                        "travelDates",
                        event.target.value,
                      )
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Rooms needed
                  </span>
                  <input
                    value={approval.roomRequirement}
                    onChange={(event) =>
                      handleFieldChange(
                        approval.id,
                        "roomRequirement",
                        event.target.value,
                      )
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              <div className="mt-8 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Travelers
                  </span>
                  <input
                    value={toTravelerString(approval.travelers)}
                    onChange={(event) =>
                      handleTravelerChange(approval.id, event.target.value)
                    }
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>

                {(approval.bookingDetails?.flight ||
                  approval.bookingDetails?.stay ||
                  approval.bookingDetails?.requestedAddOns?.length) && (
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                      Requested itinerary
                    </p>
                    <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                      {approval.bookingDetails.flight && (
                        <p>
                          <span className="font-semibold text-slate-900">
                            Flight:
                          </span>{" "}
                          {approval.bookingDetails.flight.airline},{" "}
                          {approval.bookingDetails.flight.from} to{" "}
                          {approval.bookingDetails.flight.to},{" "}
                          {approval.bookingDetails.flight.duration}, $
                          {approval.bookingDetails.flight.price}
                        </p>
                      )}
                      {approval.bookingDetails.stay && (
                        <p>
                          <span className="font-semibold text-slate-900">
                            Stay:
                          </span>{" "}
                          {approval.bookingDetails.stay.name},{" "}
                          {approval.bookingDetails.stay.price}
                        </p>
                      )}
                      {!!approval.bookingDetails.requestedAddOns?.length && (
                        <p>
                          <span className="font-semibold text-slate-900">
                            Add-ons:
                          </span>{" "}
                          {approval.bookingDetails.requestedAddOns.join(", ")}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Request details
                  </span>
                  <textarea
                    value={approval.reason}
                    onChange={(event) =>
                      handleFieldChange(approval.id, "reason", event.target.value)
                    }
                    rows={4}
                    className="resize-none rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none"
                  />
                </label>
              </div>

              {approval.itineraryShared && (
                <p className="mt-6 text-sm font-medium text-green-700">
                  Approved itinerary is now available in Trips for the traveler.
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
