"use client";

import { useEffect, useId, useRef, useState } from "react";

type GooglePlaceFieldProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  predictionTypes?: string[];
  countries?: string | string[];
};

type PlacePrediction = {
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
            ) => Promise<{ predictions: PlacePrediction[] }>;
          };
        }>;
      };
    };
    __googleMapsScriptPromise?: Promise<void>;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DEFAULT_PREDICTION_TYPES = ["(regions)"];
const fallbackDestinations = [
  "New York, New York, United States",
  "Los Angeles, California, United States",
  "Chicago, Illinois, United States",
  "Houston, Texas, United States",
  "Miami, Florida, United States",
  "Orlando, Florida, United States",
  "Atlanta, Georgia, United States",
  "Dallas, Texas, United States",
  "Seattle, Washington, United States",
  "San Francisco, California, United States",
  "Boston, Massachusetts, United States",
  "Las Vegas, Nevada, United States",
  "Denver, Colorado, United States",
  "Washington, District of Columbia, United States",
  "London, England, United Kingdom",
  "Manchester, England, United Kingdom",
  "Paris, Ile-de-France, France",
  "Rome, Lazio, Italy",
  "Milan, Lombardy, Italy",
  "Barcelona, Catalonia, Spain",
  "Madrid, Community of Madrid, Spain",
  "Amsterdam, North Holland, Netherlands",
  "Berlin, Germany",
  "Munich, Bavaria, Germany",
  "Tokyo, Japan",
  "Osaka, Japan",
  "Seoul, South Korea",
  "Singapore",
  "Bangkok, Thailand",
  "Dubai, United Arab Emirates",
  "Toronto, Ontario, Canada",
  "Vancouver, British Columbia, Canada",
  "Montreal, Quebec, Canada",
  "Mexico City, Mexico",
  "Cancun, Quintana Roo, Mexico",
  "Sydney, New South Wales, Australia",
  "Melbourne, Victoria, Australia",
  "Sao Paulo, Brazil",
  "Rio de Janeiro, Brazil",
];

function getFallbackPredictions(input: string) {
  const normalizedInput = input.trim().toLowerCase();

  if (normalizedInput.length < 2) {
    return [];
  }

  return fallbackDestinations
    .filter((destination) => destination.toLowerCase().includes(normalizedInput))
    .slice(0, 6)
    .map((destination) => ({
      description: destination,
      place_id: `fallback-${destination}`,
    }));
}

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

export default function GooglePlaceField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  predictionTypes = DEFAULT_PREDICTION_TYPES,
  countries,
}: GooglePlaceFieldProps) {
  const listboxId = useId();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const serviceRef = useRef<{
    getPlacePredictions: (
      request: {
        input: string;
        types?: string[];
        componentRestrictions?: { country: string | string[] };
      },
    ) => Promise<{ predictions: PlacePrediction[] }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setupPlaces = async () => {
      if (!GOOGLE_MAPS_API_KEY) {
        return;
      }

      await loadGoogleMapsScript();
      const places = await window.google?.maps?.importLibrary?.("places");

      if (!cancelled && places?.AutocompleteService) {
        serviceRef.current = new places.AutocompleteService();
      }
    };

    void setupPlaces();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const service = serviceRef.current;
    const fallbackPredictions = getFallbackPredictions(value);

    if (value.trim().length < 2) {
      window.setTimeout(() => setPredictions([]), 0);
      return;
    }

    let cancelled = false;

    const loadPredictions = async () => {
      if (!service) {
        setPredictions(fallbackPredictions);
        return;
      }

      try {
        const response = await service.getPlacePredictions({
          input: value,
          types: predictionTypes,
          ...(countries ? { componentRestrictions: { country: countries } } : {}),
        });

        if (!cancelled) {
          const googlePredictions = response.predictions ?? [];
          setPredictions(
            googlePredictions.length > 0 ? googlePredictions : fallbackPredictions,
          );
        }
      } catch {
        if (!cancelled) {
          setPredictions(fallbackPredictions);
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
  }, [countries, predictionTypes, value]);

  return (
    <div className="relative">
      <label className="flex items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3">
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
            className="mt-1 w-full bg-transparent text-lg text-slate-900 outline-none placeholder:text-slate-400"
          />
        </span>
      </label>

      {isFocused && predictions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          {predictions.map((prediction) => (
            <button
              key={prediction.place_id}
              type="button"
              role="option"
              aria-selected={value === prediction.description}
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(prediction.description);
                setPredictions([]);
                setIsFocused(false);
              }}
              className="block w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-blue-50"
            >
              {prediction.description}
            </button>
          ))}
          <div className="border-t border-slate-100 px-4 py-2 text-right text-xs font-semibold text-slate-500">
            Powered by Google
          </div>
        </div>
      )}
    </div>
  );
}
