"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type AirportFieldProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

type AirportOption = {
  code: string;
  city: string;
  name: string;
  region: string;
};

type GoogleAirportPrediction = {
  description: string;
  place_id: string;
};

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary?: (libraryName: "places") => Promise<{
          AutocompleteService?: new () => {
            getPlacePredictions: (
              request: {
                input: string;
                types?: string[];
                componentRestrictions?: { country: string | string[] };
              },
            ) => Promise<{ predictions: GoogleAirportPrediction[] }>;
          };
        }>;
      };
    };
    __googleMapsScriptPromise?: Promise<void>;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const airportOptions: AirportOption[] = [
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Atlanta International Airport", region: "Georgia" },
  { code: "BDL", city: "Hartford", name: "Bradley International Airport", region: "Connecticut" },
  { code: "BNA", city: "Nashville", name: "Nashville International Airport", region: "Tennessee" },
  { code: "BOI", city: "Boise", name: "Boise Airport", region: "Idaho" },
  { code: "AUS", city: "Austin", name: "Austin-Bergstrom International Airport", region: "Texas" },
  { code: "BOS", city: "Boston", name: "Logan International Airport", region: "Massachusetts" },
  { code: "BWI", city: "Baltimore", name: "Baltimore/Washington International Thurgood Marshall Airport", region: "Maryland" },
  { code: "CHS", city: "Charleston", name: "Charleston International Airport", region: "South Carolina" },
  { code: "CLE", city: "Cleveland", name: "Cleveland Hopkins International Airport", region: "Ohio" },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas International Airport", region: "North Carolina" },
  { code: "CMH", city: "Columbus", name: "John Glenn Columbus International Airport", region: "Ohio" },
  { code: "CVG", city: "Cincinnati", name: "Cincinnati/Northern Kentucky International Airport", region: "Kentucky" },
  { code: "DCA", city: "Washington", name: "Ronald Reagan Washington National Airport", region: "District of Columbia" },
  { code: "DEN", city: "Denver", name: "Denver International Airport", region: "Colorado" },
  { code: "DFW", city: "Dallas", name: "Dallas Fort Worth International Airport", region: "Texas" },
  { code: "DTW", city: "Detroit", name: "Detroit Metropolitan Wayne County Airport", region: "Michigan" },
  { code: "EWR", city: "Newark", name: "Newark Liberty International Airport", region: "New Jersey" },
  { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood International Airport", region: "Florida" },
  { code: "GSO", city: "Greensboro", name: "Piedmont Triad International Airport", region: "North Carolina" },
  { code: "GSP", city: "Greenville", name: "Greenville-Spartanburg International Airport", region: "South Carolina" },
  { code: "HOU", city: "Houston", name: "William P. Hobby Airport", region: "Texas" },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye International Airport", region: "Hawaii" },
  { code: "IAD", city: "Washington", name: "Dulles International Airport", region: "Virginia" },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental Airport", region: "Texas" },
  { code: "IND", city: "Indianapolis", name: "Indianapolis International Airport", region: "Indiana" },
  { code: "JAX", city: "Jacksonville", name: "Jacksonville International Airport", region: "Florida" },
  { code: "JFK", city: "New York", name: "John F. Kennedy International Airport", region: "New York" },
  { code: "MCI", city: "Kansas City", name: "Kansas City International Airport", region: "Missouri" },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid International Airport", region: "Nevada" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International Airport", region: "California" },
  { code: "LGA", city: "New York", name: "LaGuardia Airport", region: "New York" },
  { code: "MCO", city: "Orlando", name: "Orlando International Airport", region: "Florida" },
  { code: "MDW", city: "Chicago", name: "Chicago Midway International Airport", region: "Illinois" },
  { code: "MEM", city: "Memphis", name: "Memphis International Airport", region: "Tennessee" },
  { code: "MIA", city: "Miami", name: "Miami International Airport", region: "Florida" },
  { code: "MKE", city: "Milwaukee", name: "Milwaukee Mitchell International Airport", region: "Wisconsin" },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul International Airport", region: "Minnesota" },
  { code: "MSY", city: "New Orleans", name: "Louis Armstrong New Orleans International Airport", region: "Louisiana" },
  { code: "MYR", city: "Myrtle Beach", name: "Myrtle Beach International Airport", region: "South Carolina" },
  { code: "OAK", city: "Oakland", name: "Oakland International Airport", region: "California" },
  { code: "ORD", city: "Chicago", name: "O'Hare International Airport", region: "Illinois" },
  { code: "ORF", city: "Norfolk", name: "Norfolk International Airport", region: "Virginia" },
  { code: "PBI", city: "West Palm Beach", name: "Palm Beach International Airport", region: "Florida" },
  { code: "PDX", city: "Portland", name: "Portland International Airport", region: "Oregon" },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia International Airport", region: "Pennsylvania" },
  { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor International Airport", region: "Arizona" },
  { code: "PIT", city: "Pittsburgh", name: "Pittsburgh International Airport", region: "Pennsylvania" },
  { code: "PVD", city: "Providence", name: "Rhode Island T. F. Green International Airport", region: "Rhode Island" },
  { code: "RDU", city: "Raleigh", name: "Raleigh-Durham International Airport", region: "North Carolina" },
  { code: "RIC", city: "Richmond", name: "Richmond International Airport", region: "Virginia" },
  { code: "RSW", city: "Fort Myers", name: "Southwest Florida International Airport", region: "Florida" },
  { code: "SAN", city: "San Diego", name: "San Diego International Airport", region: "California" },
  { code: "SAT", city: "San Antonio", name: "San Antonio International Airport", region: "Texas" },
  { code: "SAV", city: "Savannah", name: "Savannah/Hilton Head International Airport", region: "Georgia" },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma International Airport", region: "Washington" },
  { code: "SFO", city: "San Francisco", name: "San Francisco International Airport", region: "California" },
  { code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose International Airport", region: "California" },
  { code: "SLC", city: "Salt Lake City", name: "Salt Lake City International Airport", region: "Utah" },
  { code: "SMF", city: "Sacramento", name: "Sacramento International Airport", region: "California" },
  { code: "SNA", city: "Santa Ana", name: "John Wayne Airport", region: "California" },
  { code: "STL", city: "St. Louis", name: "St. Louis Lambert International Airport", region: "Missouri" },
  { code: "TPA", city: "Tampa", name: "Tampa International Airport", region: "Florida" },
];

function loadGoogleMapsScript() {
  if (typeof window === "undefined" || !GOOGLE_MAPS_API_KEY) {
    return Promise.resolve();
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (window.__googleMapsScriptPromise) {
    return window.__googleMapsScriptPromise;
  }

  window.__googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      "script[data-google-maps-places]",
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = "true";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__googleMapsScriptPromise;
}

function formatAirport(option: AirportOption) {
  return `${option.code} - ${option.city}`;
}

export default function AirportField({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: AirportFieldProps) {
  const listboxId = useId();
  const [isFocused, setIsFocused] = useState(false);
  const [googlePredictions, setGooglePredictions] = useState<
    GoogleAirportPrediction[]
  >([]);
  const serviceRef = useRef<{
    getPlacePredictions: (
      request: {
        input: string;
        types?: string[];
        componentRestrictions?: { country: string | string[] };
      },
    ) => Promise<{ predictions: GoogleAirportPrediction[] }>;
  } | null>(null);
  const trimmedValue = value.trim().toLowerCase();

  const predictions = useMemo(() => {
    if (trimmedValue.length < 1) {
      return airportOptions.slice(0, 6);
    }

    return airportOptions
      .filter((airport) => {
        const searchable = `${airport.code} ${airport.city} ${airport.name} ${airport.region}`.toLowerCase();
        return searchable.includes(trimmedValue);
      })
      .slice(0, 7);
  }, [trimmedValue]);

  useEffect(() => {
    let cancelled = false;

    const setupPlaces = async () => {
      if (!GOOGLE_MAPS_API_KEY) {
        return;
      }

      try {
        await loadGoogleMapsScript();
        const places = await window.google?.maps?.importLibrary?.("places");

        if (!cancelled && places?.AutocompleteService) {
          serviceRef.current = new places.AutocompleteService();
        }
      } catch {
        serviceRef.current = null;
      }
    };

    void setupPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const service = serviceRef.current;

    if (!service || value.trim().length < 2) {
      window.setTimeout(() => setGooglePredictions([]), 0);
      return;
    }

    let cancelled = false;

    const loadPredictions = async () => {
      try {
        const response = await service.getPlacePredictions({
          input: `${value} airport`,
          types: ["establishment"],
        });

        if (!cancelled) {
          setGooglePredictions(
            (response.predictions ?? [])
              .filter((prediction) =>
                prediction.description.toLowerCase().includes("airport"),
              )
              .slice(0, 6),
          );
        }
      } catch {
        if (!cancelled) {
          setGooglePredictions([]);
        }
      }
    };

    const timeoutId = window.setTimeout(() => {
      void loadPredictions();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value]);

  const filteredGooglePredictions = googlePredictions.filter((prediction) => {
    const normalizedDescription = prediction.description.toLowerCase();
    return !predictions.some((airport) =>
      normalizedDescription.includes(airport.name.toLowerCase()),
    );
  });
  const hasPredictions =
    predictions.length > 0 || filteredGooglePredictions.length > 0;

  return (
    <div className="relative">
      <label className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
        <span className="text-slate-700">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setIsFocused(false), 120);
            }}
            placeholder={placeholder}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
          />
        </span>
      </label>

      {isFocused && hasPredictions && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {predictions.map((airport) => (
            <button
              key={airport.code}
              type="button"
              role="option"
              aria-selected={value.startsWith(airport.code)}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(formatAirport(airport));
                setIsFocused(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-blue-50"
            >
              <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-sm font-bold text-white">
                {airport.code}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">
                  {airport.city}, {airport.region}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {airport.name}
                </span>
              </span>
            </button>
          ))}
          {filteredGooglePredictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              role="option"
              aria-selected={value === prediction.description}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(prediction.description);
                setGooglePredictions([]);
                setIsFocused(false);
              }}
              className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50"
            >
              <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
                AIR
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-900">
                  {prediction.description}
                </span>
                <span className="block text-sm text-slate-500">
                  Global airport result
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
