export default function RideTegoSection() {
  return (
    <div className="mt-20 sm:mt-32">

      {/* Background Section */}
      <div className="overflow-hidden bg-gradient-to-r from-[#1e3a8a] to-[#0f172a] px-6 py-16 text-white sm:py-20">

        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2 md:items-center">

          {/* LEFT SIDE TEXT */}
          <div>
            <p className="text-md uppercase tracking-wide text-gray-300 mb-2">
              Corporate Mobility Solution
            </p>

            <h2 className="mb-4 text-3xl font-bold sm:text-4xl lg:text-5xl">
              RideTego Ground Transportation
            </h2>

            <p className="mb-6 text-lg text-gray-300 sm:text-xl">
              Need reliable transportation to and from the airport? RideTego
              provides seamless, on demand rides for corporate travelers,
              ensuring punctuality, comfort, and efficiency for every trip.
            </p>

            <p className="mb-8 text-base text-gray-400 sm:text-lg">
              From airport pickups to city travel, RideTego connects your team
              to their destinations so your business never slows down.
            </p>

            {/* APP BUTTONS */}
           <div className="flex flex-wrap items-center gap-4 sm:gap-6">

  {/* GOOGLE PLAY */}
  <a
    href="https://play.google.com/store/apps/details?id=com.tego.rider"
    target="_blank"
    className="w-14 h-14 flex items-center justify-center border border-white rounded-full hover:bg-white hover:text-black transition duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="white"
      viewBox="0 0 24 24"
      className="w-6 h-6"
    >
      <path d="M3 2l18 10L3 22V2z" />
    </svg>
  </a>

  {/* APPLE */}
  <a
    href="https://apps.apple.com/in/app/ridetego/id1467913112"
    target="_blank"
    className="w-14 h-14 flex items-center justify-center border border-white rounded-full hover:bg-white hover:text-black transition duration-300"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="white"
      viewBox="0 0 24 24"
      className="w-6 h-6"
    >
      <path d="M16.365 1.43c0 1.14-.42 2.17-1.26 3.09-.87.93-1.91 1.47-3.12 1.38-.08-1.12.45-2.2 1.3-3.08.86-.88 1.96-1.5 3.08-1.39zm4.38 16.55c-.37.85-.8 1.63-1.29 2.35-.67.97-1.22 1.63-1.64 1.98-.65.58-1.35.88-2.1.9-.54 0-1.19-.15-1.95-.46-.76-.3-1.46-.46-2.1-.46-.67 0-1.4.15-2.17.46-.77.31-1.4.47-1.9.49-.73.03-1.45-.28-2.16-.92-.45-.39-1.03-1.07-1.73-2.05C1.03 17.87 0 14.96 0 12.33c0-1.5.32-2.8.96-3.9.5-.88 1.17-1.57 2.02-2.07.85-.5 1.77-.75 2.76-.77.57 0 1.32.17 2.24.5.92.34 1.51.51 1.77.51.2 0 .87-.21 2.01-.62 1.08-.38 2-.54 2.76-.48 2.06.17 3.6 1 4.63 2.5-1.84 1.12-2.75 2.68-2.73 4.68.02 1.56.58 2.86 1.69 3.9.5.47 1.05.83 1.67 1.08-.13.38-.27.74-.41 1.09z" />
    </svg>
  </a>

</div>
          </div>

          {/* RIGHT SIDE MOCK PHONE */}

          <div className="relative flex h-[360px] items-end justify-center sm:h-[420px] md:justify-end lg:h-[500px]">



  {/* Glow */}
  <div className="absolute -bottom-4 right-1/2 h-56 w-56 translate-x-1/2 rounded-full bg-blue-500 opacity-20 blur-3xl md:right-10 md:bottom-10 md:translate-x-0 md:h-80 md:w-80"></div>

  {/* PHONE IMAGE */}
  <img
    src="/phone.png"
    alt="RideTego App"
    className="
      relative
      w-[255px] sm:w-[300px] md:w-[380px] lg:w-[440px]
      translate-y-20 sm:translate-y-12 md:translate-y-16 lg:translate-y-20
      drop-shadow-2xl
      transition duration-300
    "
  />

</div>

        </div>

      </div>

    </div>
  );
}
