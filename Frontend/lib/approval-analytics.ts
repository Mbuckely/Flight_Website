import { getApiUrl } from "@/lib/api-url";
import { getStoredAccessToken } from "@/lib/auth";

export type ApprovalAnalyticsRange = "week" | "month" | "quarter";

export type ManagerApprovalTotal = {
  email: string;
  name: string;
  totalSpend: number;
  approvedCount: number;
  averageTripCost: number;
};

export type ApprovalAnalyticsTrip = {
  id: string;
  title: string;
  route: string;
  travelDates: string;
  submittedBy: string;
  travelers: string[];
  approvedAt: string;
  approvedByEmail: string;
  approvedByName: string;
  totalPrice: number;
};

export type ApprovalAnalyticsResponse = {
  range: ApprovalAnalyticsRange;
  startDate: string;
  endDate: string;
  totalSpend: number;
  approvedCount: number;
  averageTripCost: number;
  managerOptions: Pick<ManagerApprovalTotal, "email" | "name">[];
  managerTotals: ManagerApprovalTotal[];
  trips: ApprovalAnalyticsTrip[];
};

async function parseApiResponse<T>(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The approval analytics API is not returning JSON. Restart the backend so /analytics/approvals is available.",
    );
  }

  const result = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Request failed");
  }

  return result;
}

export async function fetchApprovalAnalytics(
  range: ApprovalAnalyticsRange,
  managerEmail?: string,
) {
  const query = new URLSearchParams({ range });

  if (managerEmail) {
    query.set("managerEmail", managerEmail);
  }

  const response = await fetch(
    `${getApiUrl()}/analytics/approvals?${query.toString()}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${getStoredAccessToken()}`,
      },
    },
  );

  return parseApiResponse<ApprovalAnalyticsResponse>(response);
}
