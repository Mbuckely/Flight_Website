"use client";

import { getApiUrl } from "@/lib/api-url";

export type UserRole = "employee" | "approver" | "manager" | "admin";

export type StoredUser = {
  email?: string;
  phone?: string;
  name?: string;
  role?: UserRole;
  accessToken?: string;
};

type ProfileResponse = {
  profile?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
  } | null;
};

// Temporary stand-in for backend role lookup.
// Replace this with the authenticated user payload returned by your API.
const approverEmailAllowlist = [
  "approver@company.com",
  "manager@company.com",
];

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedUser = window.localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(storedUser) as StoredUser;
    const role = ["approver", "manager", "admin"].includes(parsedUser.role ?? "")
      ? parsedUser.role
      : "employee";

    return {
      ...parsedUser,
      role,
    };
  } catch {
    return null;
  }
}

export function getUserRole(): UserRole | null {
  return getStoredUser()?.role ?? null;
}

export function isLoggedIn() {
  return !!getStoredUser();
}

export function getStoredAccessToken() {
  return getStoredUser()?.accessToken ?? "";
}

export function isApprover() {
  const role = getUserRole();
  return role === "approver" || role === "manager" || role === "admin";
}

export function canManageUsers() {
  const role = getUserRole();
  return role === "manager" || role === "admin";
}

export function saveStoredUser(user: StoredUser) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUser: StoredUser = {
    ...user,
    role: ["approver", "manager", "admin"].includes(user.role ?? "")
      ? user.role
      : "employee",
  };

  window.localStorage.setItem("user", JSON.stringify(nextUser));
}

export function resolveRoleForEmail(email?: string): UserRole {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return "employee";
  }

  return approverEmailAllowlist.includes(normalizedEmail)
    ? "approver"
    : "employee";
}

export function buildUserFromLogin(email?: string, name?: string): StoredUser {
  return {
    email,
    name,
    role: resolveRoleForEmail(email),
  };
}

export function buildUserFromSignup(email?: string, name?: string): StoredUser {
  return {
    email,
    name,
    role: "employee",
  };
}

export async function refreshStoredUserProfile() {
  const currentUser = getStoredUser();
  const email = currentUser?.email?.trim();

  if (!email) {
    return currentUser;
  }

  const response = await fetch(
    `${getApiUrl()}/profile?email=${encodeURIComponent(email)}`,
  );

  if (!response.ok) {
    return currentUser;
  }

  const result = (await response.json()) as ProfileResponse;
  const profile = result.profile;

  if (!profile) {
    return currentUser;
  }

  const firstName = profile.first_name?.trim() ?? "";
  const lastName = profile.last_name?.trim() ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const fallbackUser = currentUser ?? {};

  const nextUser = {
    ...fallbackUser,
    email: profile.email ?? fallbackUser.email,
    phone: profile.phone ?? fallbackUser.phone,
    name: name || fallbackUser.name,
    role: profile.role ?? fallbackUser.role ?? "employee",
  };

  saveStoredUser(nextUser);
  return nextUser;
}

export async function updateStoredUserProfile(input: {
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
}) {
  const response = await fetch(`${getApiUrl()}/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const result = (await response.json()) as { error?: string };
    throw new Error(result.error ?? "Unable to update profile");
  }

  return refreshStoredUserProfile();
}
