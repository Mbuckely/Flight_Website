"use client";

import Link from "next/link";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

type ForgotPasswordResponse = {
  error?: string;
  message?: string;
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`${API_URL.replace(/\/$/, "")}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const result = (await response.json()) as ForgotPasswordResponse;

      if (!response.ok) {
        setError(result.error ?? "Unable to send reset email");
        return;
      }

      setMessage(
        result.message ??
          "If an account exists for that email, a password reset link has been sent.",
      );
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
          Reset password
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <input
            type="email"
            placeholder="Email address"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-600 py-4 text-lg font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-blue-700">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
