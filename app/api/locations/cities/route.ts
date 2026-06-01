import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CountriesNowCitiesResponse = {
  error: boolean;
  msg: string;
  data?: string[];
};

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");

  if (!state) {
    return NextResponse.json(
      { cities: [], error: "State is required." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      "https://countriesnow.space/api/v0.1/countries/state/cities",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: "India",
          state,
        }),
        next: {
          revalidate: 60 * 60 * 24,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { cities: [], error: "Unable to fetch cities." },
        { status: 500 },
      );
    }

    const result = (await response.json()) as CountriesNowCitiesResponse;

    const cities = Array.from(new Set(result.data ?? []))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      cities,
    });
  } catch (error) {
    console.error("Cities API error:", error);

    return NextResponse.json(
      { cities: [], error: "Unable to fetch cities." },
      { status: 500 },
    );
  }
}