"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiUrl } from "@/lib/api-url";
import { saveStoredUser, type UserRole } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [signupEmail, setSignupEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = signupEmail.trim();

    if (!trimmedEmail) {
      setError("Please enter your email address");
      return;
    }

    setEmail(trimmedEmail);
    setError("");
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    const trimmedPassword = password.trim();

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !trimmedPhone || !trimmedPassword) {
      setError("Please complete all fields before creating your account");
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const fullName = `${trimmedFirstName} ${trimmedLastName}`;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${getApiUrl()}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          phone: trimmedPhone,
        }),
      });

      const result = (await response.json()) as { error?: string; role?: UserRole };

      if (!response.ok) {
        setError(result.error ?? "Unable to create account");
        return;
      }

      saveStoredUser({
        email: trimmedEmail,
        phone: trimmedPhone,
        name: fullName,
        role: result.role ?? "employee",
      });

      localStorage.setItem("signupContact", trimmedPhone);
      window.dispatchEvent(new Event("authchange"));
      router.push("/dashboard");
    } catch {
      setError("Unable to reach the signup server. Make sure the backend is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setError("");
    setStep(1);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 sm:px-6">
      <img
        src="/tego-logo.png"
        alt="Background Logo"
        className="pointer-events-none absolute left-1/2 top-[60%] w-[900px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-10 sm:w-[1200px] lg:w-[1600px]"
      />

      <div className="relative w-full max-w-md rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-xl backdrop-blur sm:p-8">
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.28em] text-blue-700/70">
          Step {step} of 2
        </p>

        <h1 className="mb-3 text-3xl font-semibold leading-tight text-blue-900 sm:text-4xl">
          {step === 1 ? "What's your email?" : "Tell us a little more about you"}
        </h1>

        <p className="mb-6 text-sm leading-6 text-slate-600">
          {step === 1
            ? "Start with your email address, and we'll carry it into your account form."
            : "Finish your profile details below. Your email has already been filled in for you."}
        </p>

        {step === 1 ? (
          <form onSubmit={handleContinue} className="space-y-4">
            <input
              type="email"
              placeholder="Enter email address"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              onClick={handleContinue}
              className="w-full rounded-xl bg-red-600 py-4 text-lg font-medium text-white transition hover:bg-red-700"
            >
              Continue
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />

              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <input
              type="tel"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-4 text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-blue-200 bg-white py-4 text-lg font-medium text-blue-900 transition hover:bg-blue-50"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-red-600 py-4 text-lg font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
              >
                {isSubmitting ? "Creating..." : "Create account"}
              </button>
            </div>
          </form>
        )}

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

        <p className="mt-8 text-center text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-900">
            Log in
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-slate-500">
          New accounts are created as employees by default.
        </p>
      </div>
    </div>
  );
}
