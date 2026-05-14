import Image from "next/image";
import type { FlightOffer } from "@/lib/flights";

type FlightCardProps = {
  flight: FlightOffer;
  selected?: boolean;
  onSelect?: (flight: FlightOffer) => void;
};

export default function FlightCard({ flight, selected = false, onSelect }: FlightCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            {flight.airlineLogo && (
              <Image
                src={flight.airlineLogo}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-contain"
                unoptimized
              />
            )}
            <div>
              <p className="text-lg font-bold text-slate-900">{flight.airline}</p>
              <p className="text-sm text-slate-500">
                {flight.type} |{" "}
                {flight.stops === 0
                  ? "Nonstop"
                  : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}{" "}
                | {flight.duration}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {flight.segments.map((segment, index) => (
              <div
                key={`${segment.flightNumber ?? segment.airline}-${index}`}
                className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_auto_1fr]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {segment.departureDate}
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {segment.departureTime} {segment.departureId}
                  </p>
                  <p className="text-sm text-slate-600">
                    {segment.departureAirport}
                  </p>
                </div>
                <div className="self-center text-sm font-semibold text-slate-500">
                  {segment.durationMinutes
                    ? `${Math.floor(segment.durationMinutes / 60)}h ${segment.durationMinutes % 60}m`
                    : "Flight"}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm font-semibold text-slate-500">
                    {segment.arrivalDate}
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {segment.arrivalTime} {segment.arrivalId}
                  </p>
                  <p className="text-sm text-slate-600">
                    {segment.arrivalAirport}
                  </p>
                </div>
                <p className="md:col-span-3 text-sm text-slate-500">
                  {[segment.flightNumber, segment.airplane, segment.travelClass]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              </div>
            ))}
          </div>

          {(flight.layovers.length > 0 || typeof flight.emissionsPercent === "number") && (
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {flight.layovers.map((layover) => (
                <span
                  key={layover}
                  className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-800"
                >
                  {layover}
                </span>
              ))}
              {typeof flight.emissionsPercent === "number" && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                  {flight.emissionsPercent > 0 ? "+" : ""}
                  {flight.emissionsPercent}% emissions
                </span>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 text-left md:text-right">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Total
          </p>
          <p className="mt-1 text-3xl font-bold text-slate-900">${flight.price}</p>
          <button
            type="button"
            onClick={() => onSelect?.(flight)}
            className={`mt-4 rounded-xl px-5 py-2.5 font-semibold text-white transition ${
              selected
                ? "bg-blue-700 hover:bg-blue-800"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    </article>
  );
}
