import { getApiUrl } from "@/lib/api-url";
import { getStoredAccessToken, type UserRole } from "@/lib/auth";

export type ManagedUser = {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  role: UserRole;
};

type ManagedUsersResponse = {
  actorRole: UserRole;
  users: ManagedUser[];
};

async function parseApiResponse<T>(response: Response) {
  const result = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "Request failed");
  }

  return result;
}

function getAuthHeaders() {
  const accessToken = getStoredAccessToken();

  if (!accessToken) {
    throw new Error("Please log in again before managing users.");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function fetchManagedUsers() {
  const query = new URLSearchParams({ t: String(Date.now()) });
  const response = await fetch(`${getApiUrl()}/admin/users?${query.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  return parseApiResponse<ManagedUsersResponse>(response);
}

export async function updateManagedUserRole(userId: string, role: UserRole) {
  const response = await fetch(
    `${getApiUrl()}/admin/users/${encodeURIComponent(userId)}/role`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    },
  );

  return parseApiResponse<{ user: ManagedUser }>(response);
}
