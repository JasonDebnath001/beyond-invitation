import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CountriesNowStatesResponse = {
  error: boolean;
  msg: string;
  data?: {
    name: string;
    iso3: string;
    iso2: string;
    states: Array<{
      name: string;
      state_code?: string;
    }>;
  };
};

export async function GET() {
  try {
    const response = await fetch(
      "https://countriesnow.space/api/v0.1/countries/states",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country: "India",
        }),
        next: {
          revalidate: 60 * 60 * 24,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { states: [], error: "Unable to fetch states." },
        { status: 500 },
      );
    }

    const result = (await response.json()) as CountriesNowStatesResponse;

    const states =
      result.data?.states
        ?.map((state) => state.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)) ?? [];

    return NextResponse.json({
      states,
    });
  } catch (error) {
    console.error("States API error:", error);

    return NextResponse.json(
      { states: [], error: "Unable to fetch states." },
      { status: 500 },
    );
  }
}