import { NextResponse } from "next/server";
import { getGoalsState } from "@/lib/mirror-node";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await getGoalsState();
    return NextResponse.json(goals);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch goals" },
      { status: 500 },
    );
  }
}
