import { NextResponse } from "next/server";
import { Transaction } from "@hiero-ledger/sdk";
import { getHederaClient } from "@/lib/hedera-client";

export async function POST(req: Request) {
  const {
    signedTxBytes,
    goalId,
    userAmountHbar,
    matchedAmount,
    charityAccount,
    sponsorAccount,
    donationsTopicId,
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

    return NextResponse.json({
      success: true,
      txId,
      hashscanUrl: `https://hashscan.io/testnet/transaction/${txId}`,
      goalId,
      userAmountHbar: userAmountHbar ?? 0,
      matchedAmount: matchedAmount ?? 0,
      charityAccount,
      sponsorAccount,
      donationsTopicId,
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
