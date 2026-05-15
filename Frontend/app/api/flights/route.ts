import { NextResponse } from "next/server";
import { getBackendApiUrl } from "../_utils/backend-api";

export async function GET(request: Request) {
  const { search } = new URL(request.url);

  try {
    const response = await fetch(`${getBackendApiUrl()}/flights${search}`, {
      cache: "no-store",
    });
    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the backend flight API." },
      { status: 502 },
    );
  }
}
