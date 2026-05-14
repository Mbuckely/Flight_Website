"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveStoredUser, type UserRole } from "@/lib/auth";
import { getApiUrl } from "@/lib/api-url";

type LoginResponse = {
  error?: string;
  session?: {
    access_token?: string;
  } | null;
  profile?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    role?: UserRole;
  } | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${getApiUrl()}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const result = (await response.json()) as LoginResponse;

      if (!response.ok) {
        setError(result.error ?? "Unable to log in");
        return;
      }

      const profile = result.profile;
      const firstName = profile?.first_name?.trim() ?? "";
      const lastName = profile?.last_name?.trim() ?? "";
      const name = [firstName, lastName].filter(Boolean).join(" ");

      saveStoredUser({
        email: profile?.email ?? email.trim(),
        phone: profile?.phone,
        name: name || undefined,
        role: profile?.role ?? "employee",
        accessToken: result.session?.access_token,
      });

      if (profile?.phone) {
        localStorage.setItem("signupContact", profile.phone);
      }

      window.dispatchEvent(new Event("authchange"));
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.push(returnTo?.startsWith("/") ? returnTo : "/dashboard");
    } catch {
      setError("Unable to reach the login server. Make sure the backend is running.");
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
          Welcome back
        </h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <input
            type="email"
            placeholder="Email address"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-red-600 py-4 text-lg font-medium text-white transition hover:bg-red-700"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-blue-200" />
          <span className="text-sm text-blue-900">or</span>
          <div className="h-px flex-1 bg-blue-200" />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-blue-200 bg-slate-50 px-4 py-4 text-base font-medium text-slate-400 sm:text-lg"
          >
            Continue with Google
          </button>

          <button
            type="button"
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-blue-200 bg-slate-50 px-4 py-4 text-base font-medium text-slate-400 sm:text-lg"
          >
            Continue with Apple
          </button>
        </div>

        <p className="mt-6 text-center text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-blue-700">
            Sign up
          </Link>
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/forgot-password" className="font-semibold text-blue-700">
            Forgot your password?
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          Role access is determined after login from your account record.
        </p>
      </div>
    </div>
  );
}
