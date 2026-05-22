import { NextResponse } from "next/server";
import { Transaction } from "@hiero-ledger/sdk";
import { getHederaClient } from "@/lib/hedera-client";
import { submitHCSMessage } from "@/lib/hcs";

export async function POST(req: Request) {
  const {
    signedTxBytes,
    goalId,
    userAmountHbar,
    matchedAmount,
    charityAccount,
  } = await req.json();

  if (!signedTxBytes || !goalId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const client = getHederaClient();

    const txBytes = Buffer.from(signedTxBytes, "base64");
    const tx = Transaction.fromBytes(txBytes);

    await tx.signWithOperator(client);

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const txId = response.transactionId.toString();

    if (receipt.status.toString() !== "SUCCESS") {
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    }

    const totalSent = (userAmountHbar ?? 0) + (matchedAmount ?? 0);

    await submitHCSMessage(client, process.env.TOPIC_DONATIONS!, {
      type: "DONATION_MATCHED",
      goalId,
      userAmount: userAmountHbar ?? 0,
      matchedAmount: matchedAmount ?? 0,
      totalSent,
      charityAccount,
      txId,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      txId,
      hashscanUrl: `https://hashscan.io/testnet/transaction/${txId}`,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("[/api/execute]", err);
    return NextResponse.json(
      { error: err.message ?? "Execution failed" },
      { status: 500 },
    );
  }
}
