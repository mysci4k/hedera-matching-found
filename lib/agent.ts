import {
  TransferTransaction,
  Hbar,
  AccountId,
  TransactionId,
} from "@hiero-ledger/sdk";
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getHederaClient } from "./hedera-client";
import { getGoalsState } from "./mirror-node";
import { GOALS } from "./goals";

const checkMatchingPoolTool = new DynamicStructuredTool({
  name: "check_matching_pool",
  description:
    "Check available matching pool for a given goal. Returns how many HBAR are available for matching.",
  schema: z.object({
    goalId: z.string().describe("Goal ID: shelter | education | flood"),
  }),
  func: async ({ goalId }) => {
    const goals = await getGoalsState();
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return `Goal "${goalId}" does not exist.`;
    const remaining = goal.totalSponsorPool - goal.totalDonated / 2;
    return JSON.stringify({
      goalName: goal.name,
      charityAccount: goal.charityAccount,
      sponsorPoolTotal: goal.totalSponsorPool,
      availableForMatching: Math.max(0, remaining),
      sponsors: goal.sponsors,
    });
  },
});

const executeMatchingDonationTool = new DynamicStructuredTool({
  name: "execute_matching_donation",
  description:
    "Prepares a matching donation transaction for the user to sign via their wallet. Returns a REQUEST_SIGNATURE action with the serialized transaction bytes (Base64). The frontend will open a WalletConnect modal for the user to sign, then execute the transfer atomically.",
  schema: z.object({
    goalId: z.string(),
    userAccount: z
      .string()
      .describe("Hedera account of the user e.g. 0.0.1234"),
    userAmountHbar: z
      .number()
      .describe("Amount of HBAR contributed by the user"),
    sponsorAccount: z
      .string()
      .describe("Sponsor account from which matching is drawn"),
  }),
  func: async ({ goalId, userAccount, userAmountHbar, sponsorAccount }) => {
    const goal = GOALS.find((g) => g.id === goalId);
    if (!goal) return "Error: unknown goal.";

    const matchedAmount = userAmountHbar;
    const totalHbar = userAmountHbar + matchedAmount;

    try {
      const client = getHederaClient();

      const tx = new TransferTransaction()
        .addHbarTransfer(
          AccountId.fromString(userAccount),
          new Hbar(-userAmountHbar),
        )
        .addHbarTransfer(
          AccountId.fromString(goal.charityAccount),
          new Hbar(userAmountHbar),
        )
        .addApprovedHbarTransfer(
          AccountId.fromString(sponsorAccount),
          new Hbar(-matchedAmount),
        )
        .addHbarTransfer(
          AccountId.fromString(goal.charityAccount),
          new Hbar(matchedAmount),
        )
        .setTransactionId(
          TransactionId.generate(
            AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!),
          ),
        )
        .freezeWith(client);

      const txBytes = Buffer.from(tx.toBytes()).toString("base64");

      return JSON.stringify({
        action: "REQUEST_SIGNATURE",
        txBytes,
        goalId,
        userAccount,
        userAmountHbar,
        matchedAmount,
        totalHbar,
        sponsorAccount,
        charityAccount: goal.charityAccount,
        summary: `${userAmountHbar} HBAR from you + ${matchedAmount} HBAR matching from sponsor = ${totalHbar} HBAR for ${goal.name}`,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      return JSON.stringify({ success: false, error: err.message });
    }
  },
});

export function createMatchingAgent() {
  const client = getHederaClient();

  const toolkit = new HederaLangchainToolkit({
    client,
    configuration: {
      tools: [],
      context: { mode: AgentMode.AUTONOMOUS },
    },
  });

  const hederaTools = toolkit.getTools();
  const customTools = [checkMatchingPoolTool, executeMatchingDonationTool];
  const allTools = [...hederaTools, ...customTools];

  const llm = new ChatGoogleGenerativeAI({
    model: "gemini-3.1-flash-lite",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0,
  });

  const systemPrompt = `You are an impartial operator of the Matching Donations platform on Hedera.
Your job is to help users donate HBAR to charitable causes and automatically double their contributions using sponsor pools.

Available goals:
- shelter: "Animal Shelter"
- education: "Education Foundation 2030"
- flood: "Flood Relief"

Rules:
1. When a user wants to donate, first use check_matching_pool to verify available matching
2. ALWAYS confirm the amount with the user before executing: "Your X HBAR + Y HBAR matching = Z HBAR for [goal]. Do you confirm?"
3. Call execute_matching_donation ONLY when the user explicitly confirms (e.g. "yes", "confirm", "ok", "tak")
4. execute_matching_donation will return a REQUEST_SIGNATURE action – respond by telling the user:
   "Please sign the transaction in your wallet. A WalletConnect window will open shortly."
   Do NOT say the transaction is complete yet – it requires the user's wallet signature first.
5. If the sponsor pool is insufficient, inform the user and suggest a lower amount
6. Communicate in English`;

  return createReactAgent({
    llm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: allTools as any,
    prompt: systemPrompt,
  });
}
