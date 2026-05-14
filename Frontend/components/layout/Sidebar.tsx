"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canManageUsers, getStoredUser, isApprover } from "@/lib/auth";

const quickActions = [
  { href: "/book-flight", label: "Book Flight" },
  { href: "/book-flight?tab=stays", label: "Book Stay" },
  { href: "/approvals", label: "Approvals" },
  { href: "/admin/users", label: "Users" },
  { href: "/trips", label: "View Trips" },
];

function formatWelcomeName() {
  if (typeof window === "undefined") {
    return "Traveler";
  }

  const storedUser = getStoredUser();
  const storedContact = localStorage.getItem("signupContact");

  if (storedUser) {
    if (storedUser.name?.trim()) {
      return storedUser.name.trim();
    }

    if (storedUser.email?.trim()) {
      return storedUser.email.split("@")[0];
    }
  }

  if (storedContact?.trim()) {
    return storedContact.includes("@")
      ? storedContact.split("@")[0]
      : storedContact;
  }

  return "Traveler";
}

export default function Sidebar() {
  const [welcomeName, setWelcomeName] = useState("Traveler");
  const [canViewApprovals, setCanViewApprovals] = useState(false);
  const [canViewUsers, setCanViewUsers] = useState(false);

  useEffect(() => {
    const syncWelcomeName = () => {
      setWelcomeName(formatWelcomeName());
      setCanViewApprovals(isApprover());
      setCanViewUsers(canManageUsers());
    };

    window.addEventListener("authchange", syncWelcomeName);
    window.addEventListener("focus", syncWelcomeName);
    window.addEventListener("pageshow", syncWelcomeName);
    syncWelcomeName();

    return () => {
      window.removeEventListener("authchange", syncWelcomeName);
      window.removeEventListener("focus", syncWelcomeName);
      window.removeEventListener("pageshow", syncWelcomeName);
    };
  }, []);

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
        <div />

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            Corporate Travel
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500">Welcome back</p>
          <p className="text-lg font-semibold text-slate-900 capitalize">
            {welcomeName}
          </p>
        </div>

        <div />
      </div>

      <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {quickActions.map((action) => {
            if (action.href === "/approvals" && !canViewApprovals) {
              return null;
            }

            if (action.href === "/admin/users" && !canViewUsers) {
              return null;
            }

            return (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-700 transition hover:text-blue-900"
              >
                {action.label}
              </Link>
            );
          })}
        </div>

        <Link
          href="/settings"
          className="text-center text-sm font-semibold uppercase tracking-[0.14em] text-blue-700 transition hover:text-blue-900 lg:justify-self-end lg:text-right"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
