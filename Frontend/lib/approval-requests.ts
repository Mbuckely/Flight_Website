export type ApprovalStatus =
  | "Pending"
  | "Finance Review"
  | "Leadership Review"
  | "Changes Requested"
  | "Approved"
  | "Cancelled";

export type ApprovalRequest = {
  id: string;
  title: string;
  submittedBy: string;
  approverEmail?: string;
  approverName?: string;
  fromLocation: string;
  toLocation: string;
  route: string;
  travelDates: string;
  roomRequirement: string;
  travelers: string[];
  bookingDetails?: {
    flight?: {
      airline: string;
      from: string;
      to: string;
      duration: string;
      price: number;
    };
    stay?: {
      name: string;
      details: string;
      price: string;
    };
    requestedAddOns?: string[];
  };
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  itineraryShared: boolean;
};

export type TravelRequestInput = {
  submittedBy: string;
  approverEmail: string;
  approverName: string;
  travelers: string[];
  fromLocation: string;
  toLocation: string;
  travelDates: string;
  roomRequirement: string;
  bookingDetails?: ApprovalRequest["bookingDetails"];
  reason: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const STORAGE_KEY = "approvalRequests";

const seedApprovalRequests: ApprovalRequest[] = [
  {
    id: "approval-1",
    title: "Executive offsite travel",
    submittedBy: "Operations Team",
    fromLocation: "Chicago",
    toLocation: "New York",
    route: "Chicago to New York",
    travelDates: "April 18, 2026 - April 20, 2026",
    roomRequirement: "4 rooms",
    travelers: ["Jordan Lee", "Avery Patel", "Morgan Chen", "Taylor Brooks"],
    reason:
      "Leadership offsite travel requires approval before flights and hotel blocks are confirmed.",
    status: "Leadership Review",
    requestedAt: "April 15, 2026",
    itineraryShared: false,
  },
  {
    id: "approval-2",
    title: "Client visit request",
    submittedBy: "Sales Team",
    fromLocation: "Houston",
    toLocation: "Boston",
    route: "Houston to Boston",
    travelDates: "April 22, 2026 - April 23, 2026",
    roomRequirement: "2 rooms",
    travelers: ["Sofia Ramirez", "Liam Carter"],
    reason:
      "Last-minute client visit needs approval for travel and overnight stay coverage.",
    status: "Pending",
    requestedAt: "April 15, 2026",
    itineraryShared: false,
  },
  {
    id: "approval-3",
    title: "Flexible fare request",
    submittedBy: "Executive Office",
    fromLocation: "Dallas",
    toLocation: "San Francisco",
    route: "Dallas to San Francisco",
    travelDates: "April 26, 2026 - April 28, 2026",
    roomRequirement: "1 suite",
    travelers: ["Cameron Reed"],
    reason:
      "Leadership travel requires a flexible itinerary and upgraded room arrangement.",
    status: "Finance Review",
    requestedAt: "April 15, 2026",
    itineraryShared: false,
  },
];

function buildRoute(fromLocation: string, toLocation: string) {
  return `${fromLocation.trim()} to ${toLocation.trim()}`;
}

function dispatchApprovalChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("approvalchange"));
  }
}

export function getApprovalRequests(): ApprovalRequest[] {
  if (typeof window === "undefined") {
    return seedApprovalRequests;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedApprovalRequests));
    return seedApprovalRequests;
  }

  try {
    const parsed = JSON.parse(stored) as ApprovalRequest[];
    return parsed.length ? parsed : seedApprovalRequests;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedApprovalRequests));
    return seedApprovalRequests;
  }
}

export function saveApprovalRequests(requests: ApprovalRequest[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  dispatchApprovalChange();
}

export function submitTravelRequest(input: TravelRequestInput) {
  const requests = getApprovalRequests();
  const nextRequest: ApprovalRequest = {
    id: `approval-${Date.now()}`,
    title: `${input.toLocation} travel request`,
    submittedBy: input.submittedBy,
    approverEmail: input.approverEmail,
    approverName: input.approverName,
    fromLocation: input.fromLocation.trim(),
    toLocation: input.toLocation.trim(),
    route: buildRoute(input.fromLocation, input.toLocation),
    travelDates: input.travelDates.trim(),
    roomRequirement: input.roomRequirement.trim(),
    travelers: input.travelers,
    bookingDetails: input.bookingDetails,
    reason: input.reason.trim(),
    status: "Pending",
    requestedAt: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    itineraryShared: false,
  };

  saveApprovalRequests([nextRequest, ...requests]);
  return nextRequest;
}

export function updateApprovalRequest(
  id: string,
  updates: Partial<ApprovalRequest>,
) {
  const requests = getApprovalRequests();
  const nextRequests = requests.map((request) => {
    if (request.id !== id) {
      return request;
    }

    const nextRequest = {
      ...request,
      ...updates,
    };

    return {
      ...nextRequest,
      route: buildRoute(nextRequest.fromLocation, nextRequest.toLocation),
    };
  });

  saveApprovalRequests(nextRequests);
  return nextRequests;
}

async function parseApiResponse<T>(response: Response) {
  const result = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Request failed");
  }

  return result;
}

export async function fetchApprovalRequests(email?: string) {
  if (!email) {
    return getApprovalRequests();
  }

  try {
    const query = new URLSearchParams({ email });
    const response = await fetch(
      `${API_URL.replace(/\/$/, "")}/approval-requests?${query.toString()}`,
    );
    const result = await parseApiResponse<{ requests: ApprovalRequest[] }>(response);
    saveApprovalRequests(result.requests);
    return result.requests;
  } catch {
    return getApprovalRequests();
  }
}

export async function createApprovalRequest(input: TravelRequestInput) {
  const response = await fetch(`${API_URL.replace(/\/$/, "")}/approval-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const result = await parseApiResponse<{ request: ApprovalRequest }>(response);
  saveApprovalRequests([result.request, ...getApprovalRequests()]);
  return result.request;
}

export async function saveApprovalRequestUpdate(
  id: string,
  updates: Partial<ApprovalRequest>,
  actorEmail?: string,
) {
  const response = await fetch(
    `${API_URL.replace(/\/$/, "")}/approval-requests/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...updates,
        actorEmail,
      }),
    },
  );
  const result = await parseApiResponse<{ request: ApprovalRequest }>(response);
  const nextRequests = updateApprovalRequest(id, result.request);
  return nextRequests;
}
