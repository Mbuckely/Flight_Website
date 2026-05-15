import { NextResponse } from "next/server";
import { getBackendApiUrl } from "../_utils/backend-api";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  const authorization = request.headers.get("authorization");

  try {
    const response = await fetch(`${getBackendApiUrl()}/hotels${search}`, {
      cache: "no-store",
      headers: authorization ? { Authorization: authorization } : undefined,
    });
    const result = await response.json();

    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the backend hotel API." },
      { status: 502 },
    );
  }
}
