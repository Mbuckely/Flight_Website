"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type ResetPasswordResponse = {
  error?: string;
  message?: string;
};

function getAccessTokenFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.get("access_token") ?? "";
}

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAccessToken(getAccessTokenFromUrl());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    if (!accessToken) {
      setError("This password reset link is invalid or expired.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL.replace(/\/$/, "")}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken,
          newPassword: password,
        }),
      });

      const result = (await response.json()) as ResetPasswordResponse;

      if (!response.ok) {
        setError(result.error ?? "Unable to reset password");
        return;
      }

      setMessage(result.message ?? "Password updated successfully");
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState(null, "", "/reset-password");
    } catch {
      setError("Unable to reach the password reset server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 sm:px-6">
      <img
        src="/tego-logo.png"
        alt="Background Logo"
        className="pointer-events-none absolute left-1/2 top-[60%] w-[900px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-10 sm:w-[1200px] lg:w-[1600px]"
      />

      <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
        <h1 className="mb-6 text-center text-3xl font-semibold leading-tight text-blue-900 sm:text-4xl">
          New password
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input
            type="password"
            placeholder="New password"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <input
            type="password"
            placeholder="Confirm new password"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-600 py-4 text-lg font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Back to{" "}
          <Link href="/login" className="font-semibold text-blue-700">
            login
          </Link>
        </p>
      </div>
    </div>
  );
}
