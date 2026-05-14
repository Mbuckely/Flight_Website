export type HotelProperty = {
  id: string;
  type: string;
  name: string;
  link?: string;
  description: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  checkInTime?: string;
  checkOutTime?: string;
  pricePerNight: string;
  pricePerNightValue?: number;
  totalPrice: string;
  totalPriceValue?: number;
  priceBeforeTaxes?: string;
  deal?: string;
  hotelClass?: string;
  hotelClassValue?: number;
  rating?: number;
  reviews?: number;
  locationRating?: number;
  airportAccessRating?: number;
  amenities: string[];
  nearbyPlaces: {
    name: string;
    transportation: string;
  }[];
  image?: string;
  thumbnail?: string;
};

export type HotelSearchResponse = {
  hotels?: HotelProperty[];
  error?: string;
  pagination?: {
    next_page_token?: string;
  } | null;
  totalResults?: number;
};
