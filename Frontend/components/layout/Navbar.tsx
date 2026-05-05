"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isLoggedIn as getIsLoggedIn } from "@/lib/auth";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/book-flight", label: "Flights" },
  {
    href: "https://ridetego.net/",
    label: "Corporate Transportation",
    external: true,
  },
];

const primaryNavTextClass =
  "text-[13px] font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition-colors hover:text-[#1d2d8f]";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => getIsLoggedIn(),
  );
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAuthState = () => {
      setIsLoggedIn(getIsLoggedIn());
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (!aboutRef.current?.contains(event.target as Node)) {
        setAboutOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAboutOpen(false);
      }
    };

    const handlePageShow = () => {
      syncAuthState();
      setAboutOpen(false);
      setMobileMenuOpen(false);
    };

    const handleWindowFocus = () => {
      syncAuthState();
      setAboutOpen(false);
      setMobileMenuOpen(false);
    };

    const handleStorage = () => {
      syncAuthState();
    };

    const handleAuthChange = () => {
      syncAuthState();
      setMobileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("authchange", handleAuthChange);
    syncAuthState();

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("authchange", handleAuthChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("authchange"));
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5 backdrop-blur after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-[#2737a7]/20 after:to-transparent">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-16">
        <Link
          href="/"
          className="shrink-0 flex items-center transition-opacity hover:opacity-90"
          aria-label="RideTEGO home"
        >
          <Image
            src="/tego-logo.png"
            alt="RideTEGO"
            width={245}
            height={78}
            priority
            className="h-auto w-[170px] sm:w-[205px]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-[#2737a7] transition hover:bg-slate-50 lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {mobileMenuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-4 lg:flex lg:gap-6">
          <div className="flex min-w-0 items-center gap-4 lg:gap-7">
            {navLinks.map((link) => (
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  {link.label}
                </Link>
              )
            ))}

            <div ref={aboutRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAboutOpen((open) => !open)}
                aria-expanded={aboutOpen}
                aria-haspopup="menu"
                className={`${primaryNavTextClass} flex items-center gap-1 whitespace-nowrap`}
              >
                About
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className={`h-4 w-4 transition-transform ${
                    aboutOpen ? "rotate-180" : ""
                  }`}
                  fill="currentColor"
                >
                  <path d="M5.25 7.5 10 12.25 14.75 7.5" />
                </svg>
              </button>

              {aboutOpen && (
                <div className="absolute right-0 top-full mt-4 w-60 rounded-xl border border-slate-200 bg-white py-3 text-left text-sm font-medium normal-case tracking-normal text-slate-700 shadow-xl">
                  <Link
                    href="/about"
                    className="block px-5 py-2.5 hover:bg-slate-50"
                    onClick={() => setAboutOpen(false)}
                  >
                    About Us
                  </Link>
                  <Link
                    href="/mission"
                    className="block px-5 py-2.5 hover:bg-slate-50"
                    onClick={() => setAboutOpen(false)}
                  >
                    Our Mission
                  </Link>
                  <Link
                    href="/solutions"
                    className="block px-5 py-2.5 hover:bg-slate-50"
                    onClick={() => setAboutOpen(false)}
                  >
                    Solutions
                  </Link>
                  <Link
                    href="/contact"
                    className="block px-5 py-2.5 hover:bg-slate-50"
                    onClick={() => setAboutOpen(false)}
                  >
                    Contact
                  </Link>
                  <a
                    href="https://ridetego.net/"
                    className="block px-5 py-2.5 hover:bg-slate-50"
                    onClick={() => setAboutOpen(false)}
                  >
                    Corporate Transportation
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-5 pl-2 lg:gap-6 lg:pl-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className={`${primaryNavTextClass} whitespace-nowrap`}
                >
                  Signup
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <div className="grid gap-2">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}

            <Link
              href="/about"
              className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              About Us
            </Link>
            <Link
              href="/mission"
              className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              Our Mission
            </Link>
            <Link
              href="/solutions"
              className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              Solutions
            </Link>
            <Link
              href="/contact"
              className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>

            <div className="mt-2 border-t border-slate-100 pt-2">
              {isLoggedIn ? (
                <div className="grid gap-2">
                  <Link
                    href="/dashboard"
                    className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Link
                    href="/login"
                    className="rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#2737a7] transition hover:bg-slate-50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-[#2737a7] px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-[#1d2d8f]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Signup
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
