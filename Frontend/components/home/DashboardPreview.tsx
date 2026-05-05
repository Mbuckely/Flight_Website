"use client";

import { useEffect, useRef, useState } from "react";

function CountUp({
  target,
  duration = 1000,
  isActive,
}: {
  target: number;
  duration?: number;
  isActive: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    let start = 0;
    const increment = target / (duration / 16);

    const timer = setInterval(() => {
      start += increment;

      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target, duration, isActive]);

  return <span>{count}</span>;
}

export default function DashboardPreview() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.35 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="mt-20 px-0 sm:mt-32 sm:px-6">
      <div className="mb-10 text-center">
        <h2 className="mb-4 text-3xl font-bold text-blue-900">
          Built for Companies
        </h2>

        <p className="text-gray-600">
          A centralized dashboard for managing all travel.
        </p>
      </div>

      <div className="mx-auto max-w-5xl rounded-2xl border bg-white p-6 shadow-xl">
        <div className="mb-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <h3 className="text-xl font-bold text-blue-900">
              <CountUp target={24} duration={1200} isActive={isVisible} />
            </h3>
          </div>

          <div className="rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-500">Upcoming Flights</p>
            <h3 className="text-xl font-bold text-blue-900">
              <CountUp target={5} duration={1200} isActive={isVisible} />
            </h3>
          </div>

          <div className="rounded-lg bg-gray-100 p-4">
            <p className="text-sm text-gray-500">Completed Trips</p>
            <h3 className="text-xl font-bold text-blue-900">
              <CountUp target={19} duration={1200} isActive={isVisible} />
            </h3>
          </div>
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <div className="mb-2 hidden justify-between text-sm text-gray-500 sm:flex">
            <span>Route</span>
            <span>Date</span>
            <span>Status</span>
          </div>

          <div className="grid gap-1 border-t py-3 text-sm sm:flex sm:justify-between sm:py-2 sm:text-base">
            <span>NYC → LAX</span>
            <span>Apr 15</span>
            <span className="font-medium text-green-600">Upcoming</span>
          </div>

          <div className="grid gap-1 border-t py-3 text-sm sm:flex sm:justify-between sm:py-2 sm:text-base">
            <span>ATL → MIA</span>
            <span>Mar 10</span>
            <span className="text-gray-500">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
