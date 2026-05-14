"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import {
  getStoredUser,
  saveStoredUser,
  updateStoredUserProfile,
} from "@/lib/auth";

function formatRole(role?: string) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "manager") {
    return "Manager";
  }

  if (role === "approver") {
    return "Approver";
  }

  return "Employee";
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storedUser = getStoredUser();
    const storedContact = localStorage.getItem("signupContact");

    if (storedUser) {
      if (storedUser.email) {
        return storedUser.email;
      }
    }

    if (storedContact?.includes("@")) {
      return storedContact;
    }

    return "";
  });
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storedContact = localStorage.getItem("signupContact");
    return storedContact && !storedContact.includes("@") ? storedContact : "";
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      router.push("/login");
    }
  }, [router]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const currentUser = getStoredUser();
    setMessage("");
    setError("");

    if (!email.trim() || !phone.trim()) {
      setError("Email and phone are required.");
      return;
    }

    try {
      await updateStoredUserProfile({
        email,
        phone,
        firstName: currentUser?.name?.split(" ")[0],
        lastName: currentUser?.name?.split(" ").slice(1).join(" "),
      });
      localStorage.setItem("signupContact", phone || email);
      window.dispatchEvent(new Event("authchange"));
      setMessage("Settings updated.");
    } catch (err) {
      saveStoredUser({
        ...(currentUser ?? {}),
        email,
        phone,
        role: currentUser?.role ?? "employee",
      });
      setError(err instanceof Error ? err.message : "Unable to update settings.");
    }
  };

  const handleDeleteAccount = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("signupContact");
    window.dispatchEvent(new Event("authchange"));
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Sidebar />

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            Settings
          </p>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">
            Manage your account details.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Keep your booking contact information current so confirmations and
            travel updates reach the right person.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <form
            onSubmit={handleSave}
            className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Account Information
            </p>
            <div className="mt-8 grid gap-5">
              <label className="grid gap-2">
                <span className="font-medium text-slate-800">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="rounded-2xl border border-slate-200 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-700"
                />
              </label>

              <label className="grid gap-2">
                <span className="font-medium text-slate-800">Phone Number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="(555) 555-5555"
                  className="rounded-2xl border border-slate-200 px-4 py-4 text-slate-900 outline-none transition focus:border-blue-700"
                />
              </label>

              <label className="grid gap-2">
                <span className="font-medium text-slate-800">Account Role</span>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-slate-700">
                  {formatRole(getStoredUser()?.role)}
                </div>
                <p className="text-sm text-slate-500">
                  Role access is managed by your backend account record.
                </p>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-2xl bg-blue-900 px-6 py-3 font-semibold text-white transition hover:bg-blue-800"
              >
                Update Email & Number
              </button>
              {message && (
                <p className="self-center text-sm font-medium text-green-700">
                  {message}
                </p>
              )}
              {error && (
                <p className="self-center text-sm font-medium text-red-600">
                  {error}
                </p>
              )}
            </div>
          </form>

          <section className="rounded-[2rem] border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-600">
              Delete Account
            </p>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">
              Remove your account from this demo app
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              This clears the current saved login and contact info from local
              storage and sends you back to the homepage.
            </p>

            <button
              type="button"
              onClick={handleDeleteAccount}
              className="mt-8 rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700"
            >
              Delete Account
            </button>
          </section>
        </section>
      </div>
    </main>
  );
}
