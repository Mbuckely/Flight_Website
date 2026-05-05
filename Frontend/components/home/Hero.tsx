"use client";

import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-6 text-center sm:min-h-[85vh]">

  {/* BACKGROUND IMAGE */}
  <div className="absolute inset-0 z-0">
    <img
      src="/aiport_en.jpeg" 
      alt="Airport Background"
      className="w-full h-full object-cover"
    />
  </div>

  {/* OVERLAY */}
  <div className="absolute inset-0 z-10 bg-black/40"></div>

  {/* CONTENT */}
  <div className="relative z-20 max-w-3xl">

    <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
  Corporate Flight Booking Made Easy
</h1>

<p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-200 sm:text-xl lg:text-2xl">
  Book flights, manage employee travel, and streamline company logistics all in one powerful platform.
</p>

<div className="flex flex-wrap justify-center gap-4 sm:gap-6">

  {/* GET STARTED */}
  <button
    onClick={() => router.push("/login")}
    className="rounded-xl bg-red-600 px-6 py-3 text-base text-white shadow-lg transition duration-200 hover:scale-105 hover:bg-red-700 focus:outline-none sm:px-8 sm:py-4 sm:text-lg"
  >
    Get Started
  </button>

  {/* LEARN MORE */}
  <button
    onClick={() => router.push("/about")}
    className="rounded-xl border border-white px-6 py-3 text-base text-white transition duration-200 hover:scale-105 hover:bg-white/10 focus:outline-none sm:px-8 sm:py-4 sm:text-lg"
  >
    Learn More
  </button>

</div>

  </div>

</div>
  );
}
