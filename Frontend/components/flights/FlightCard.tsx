import type { FlightOffer } from "@/lib/amadeus";

type FlightCardProps = {
  flight: FlightOffer;
  selected?: boolean;
  onSelect?: (flight: FlightOffer) => void;
};

export default function FlightCard({ flight, selected = false, onSelect }: FlightCardProps) {
  return (
    <div className="flex justify-between rounded bg-white p-4 shadow">
      <div>
        <p className="font-bold text-slate-900">{flight.airline}</p>
        <p className="text-slate-700">
          {flight.from} {"->"} {flight.to}
        </p>
        <p className="text-slate-600">{flight.duration}</p>
      </div>

      <div className="text-right">
        <p className="font-bold text-slate-900">${flight.price}</p>
        <button
          type="button"
          onClick={() => onSelect?.(flight)}
          className={`mt-2 rounded px-3 py-1 text-white transition ${
            selected
              ? "bg-blue-700 hover:bg-blue-800"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {selected ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  );
}
