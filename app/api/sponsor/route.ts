import { NextResponse } from "next/server";
import { getHederaClient } from "@/lib/hedera-client";
import { submitHCSMessage } from "@/lib/hcs";

export async function POST(req: Request) {
  const { goalId, sponsorAccount, sponsorLabel, amountHbar } = await req.json();

  if (!goalId || !sponsorAccount || !amountHbar) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const client = getHederaClient();

    await submitHCSMessage(client, process.env.TOPIC_POOLS!, {
      type: "POOL_CREATED",
      goalId,
      sponsorAccount,
      sponsorLabel: sponsorLabel ?? sponsorAccount,
      amountHbar: Number(amountHbar),
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to register sponsor pool" },
      { status: 500 },
    );
  }
}
