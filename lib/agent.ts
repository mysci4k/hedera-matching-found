import {
  TransferTransaction,
  Hbar,
  AccountId,
  TransactionId,
} from "@hiero-ledger/sdk";
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import {
  coreAccountPlugin,
  coreAccountQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
  coreTransactionQueryPlugin,
} from "@hashgraph/hedera-agent-kit/plugins";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import { createAgent } from "langchain";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { z } from "zod";
import { getHederaClient } from "./hedera-client";
import { getGoalsState } from "./mirror-node";
import { GOALS } from "./goals";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeSchemaForGemini(schema: any): any {
  if (typeof schema !== "object" || schema === null) return schema;
  if (Array.isArray(schema)) return schema.map(sanitizeSchemaForGemini);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "type" && Array.isArray(value)) {
      const nonNull = (value as string[]).filter((t) => t !== "null");
      result[key] =
        nonNull.length === 1 ? nonNull[0] : (nonNull[0] ?? "string");
      continue;
    }

    if ((key === "anyOf" || key === "oneOf") && Array.isArray(value)) {
      const nonNull = (value as object[]).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) =>
          s?.type !== "null" &&
          !(s?.type === undefined && Object.keys(s).length === 0),
      );
      if (nonNull.length === 1) {
        const merged = sanitizeSchemaForGemini(nonNull[0]);
        Object.assign(result, merged);
      } else if (nonNull.length > 1) {
        result[key] = nonNull.map(sanitizeSchemaForGemini);
      }
      continue;
    }

    result[key] = sanitizeSchemaForGemini(value);
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeToolsForGemini(tools: any[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tools.map((tool: any) => {
    const original = tool.schema;
    if (!original) return tool;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jsonSchema: any =
      typeof original.parse === "function" ? toJsonSchema(original) : original;
    const sanitized = sanitizeSchemaForGemini(jsonSchema);
    return Object.create(Object.getPrototypeOf(tool), {
      ...Object.getOwnPropertyDescriptors(tool),
      schema: {
        value: sanitized,
        writable: true,
        enumerable: true,
        configurable: true,
      },
    });
  });
}

const checkMatchingPoolTool = new DynamicStructuredTool({
  name: "check_matching_pool",
  description:
    "Check available matching pool for a given goal. Returns how many HBAR are available for matching. " +
    "Topic IDs for reference: pools=" +
    (process.env.TOPIC_POOLS ?? "see env TOPIC_POOLS") +
    ", donations=" +
    (process.env.TOPIC_DONATIONS ?? "see env TOPIC_DONATIONS") +
    ". You can also use GET_TOPIC_MESSAGES_QUERY_TOOL to query these topics directly.",
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
      poolsTopicId: process.env.TOPIC_POOLS,
      donationsTopicId: process.env.TOPIC_DONATIONS,
    });
  },
});

const prepareUserDonationTool = new DynamicStructuredTool({
  name: "prepare_user_donation",
  description:
    "Prepares the user's donation transaction (user → charity) for signing via WalletConnect. " +
    "Returns a REQUEST_SIGNATURE action with serialized transaction bytes (Base64). " +
    "Also returns sponsorAccount and charityAccount so you know the exact account IDs to use in subsequent steps. " +
    "After the user signs and the transaction is confirmed, use transfer_hbar_with_allowance_tool " +
    "to execute the sponsor's matching transfer (sponsor → charity using allowance), " +
    "then use SUBMIT_TOPIC_MESSAGE_TOOL to record the DONATION_MATCHED event on HCS topic " +
    (process.env.TOPIC_DONATIONS ?? "TOPIC_DONATIONS") +
    ".",
  schema: z.object({
    goalId: z.string().describe("Goal ID: shelter | education | flood"),
    userAccount: z
      .string()
      .describe("Hedera account of the user e.g. 0.0.1234"),
    userAmountHbar: z
      .number()
      .describe("Amount of HBAR the user wants to donate"),
  }),
  func: async ({ goalId, userAccount, userAmountHbar }) => {
    const goal = GOALS.find((g) => g.id === goalId);
    if (!goal) return "Error: unknown goal.";

    const goals = await getGoalsState();
    const goalState = goals.find((g) => g.id === goalId);
    const sponsorAccount =
      goalState?.sponsors?.[0]?.account ?? process.env.SPONSOR_ACCOUNT_ID ?? "";
    if (!sponsorAccount)
      return "Error: no sponsor account found for this goal.";

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
        donationsTopicId: process.env.TOPIC_DONATIONS,
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
      plugins: [
        coreAccountPlugin,
        coreAccountQueryPlugin,
        coreConsensusPlugin,
        coreConsensusQueryPlugin,
        coreTransactionQueryPlugin,
      ],
      context: { mode: AgentMode.AUTONOMOUS },
    },
  });

  const hederaTools = toolkit.getTools();
  const customTools = [checkMatchingPoolTool, prepareUserDonationTool];
  const allTools = sanitizeToolsForGemini([...hederaTools, ...customTools]);

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

HCS Topics (Hedera Consensus Service):
- Pools topic (${process.env.TOPIC_POOLS ?? "TOPIC_POOLS"}): records sponsor pool registrations
- Donations topic (${process.env.TOPIC_DONATIONS ?? "TOPIC_DONATIONS"}): records completed matched donations

## Donation flow (two separate transactions via plugins)

Step 1 — User donation (requires wallet signature):
  Call prepare_user_donation → returns REQUEST_SIGNATURE with sponsorAccount and charityAccount embedded in the response.
  The frontend will open WalletConnect for the user to sign.
  Once confirmed, the frontend sends back a message with the confirmed txId and donation details.
  IMPORTANT: store sponsorAccount and charityAccount from the prepare_user_donation response — you will need them in Step 2.

Step 2 — Sponsor matching (executed autonomously by you via plugin):
  After receiving confirmation with txId, call transfer_hbar_with_allowance_tool with EXACTLY these parameters:
    - sourceAccountId: <sponsorAccount>   ← REQUIRED: use the exact "sponsorAccount" value from the prepare_user_donation response (e.g. "0.0.XXXXX")
    - transfers: [{ accountId: <charityAccount>, amount: <matchedAmount> }]   ← use "charityAccount" and "matchedAmount" from prepare_user_donation response; amount must be positive
    - transactionMemo: "Matching donation for <goalId> txId:<userTxId>"
  sourceAccountId MUST always be set to the sponsor's account ID — it is the account whose allowance is debited. Never omit it or leave it undefined.
  The sponsor has pre-approved an HBAR allowance for the operator account, so this executes immediately without a wallet signature.

Step 3 — Record on HCS (executed autonomously by you via plugin):
  After the sponsor transfer succeeds, extract the sponsor transaction ID from the tool response
  (format: "Transaction ID: <sponsorTxId>"). Then call SUBMIT_TOPIC_MESSAGE_TOOL with:
    - topicId: <donationsTopicId>
    - message: JSON string with type "DONATION_MATCHED", goalId, userAmount, matchedAmount, totalSent, charityAccount, txId, timestamp

## Available Hedera plugin tools
- GET_HBAR_BALANCE_QUERY_TOOL: check HBAR balance of any account
- TRANSFER_HBAR_WITH_ALLOWANCE_TOOL: transfer HBAR using an existing allowance (for sponsor matching)
- GET_TOPIC_MESSAGES_QUERY_TOOL: read raw messages from HCS topics
- GET_TOPIC_INFO_QUERY_TOOL: get info about an HCS topic
- SUBMIT_TOPIC_MESSAGE_TOOL: submit a message to an HCS topic
- GET_TRANSACTION_RECORD_QUERY_TOOL: look up a transaction by ID to verify it succeeded

## Rules
1. When a user wants to donate, first use check_matching_pool to verify available matching
2. Optionally use GET_HBAR_BALANCE_QUERY_TOOL to confirm the user has enough HBAR
3. ALWAYS confirm the amount with the user before executing: "Your X HBAR + Y HBAR matching = Z HBAR for [goal]. Do you confirm?"
4. Call prepare_user_donation ONLY when the user explicitly confirms (e.g. "yes", "confirm", "ok", "tak")
5. prepare_user_donation returns a REQUEST_SIGNATURE action — respond: "Please sign the transaction in your wallet. A WalletConnect window will open shortly." Do NOT say the transaction is complete yet.
6. When the frontend confirms the user txId, immediately execute Step 2 (TRANSFER_HBAR_WITH_ALLOWANCE_TOOL) then Step 3 (SUBMIT_TOPIC_MESSAGE_TOOL)
7. After both steps succeed, inform the user with this exact format:
   "Donation complete! X HBAR from you + Y HBAR matched by sponsor = Z HBAR sent to [goal].

   User donation: https://hashscan.io/testnet/transaction/<userTxId>
   Sponsor matching: https://hashscan.io/testnet/transaction/<sponsorTxId>"

   Use the userTxId and hashscan URL provided in the frontend confirmation message.
   Use the sponsorTxId extracted from the transfer_hbar_with_allowance_tool response (format: "Transaction ID: <sponsorTxId>").
   Build the sponsor link as: https://hashscan.io/testnet/transaction/<sponsorTxId>
   Do NOT use markdown link syntax — output plain URLs only.
8. If the sponsor pool is insufficient, inform the user and suggest a lower amount
9. If the user asks about topic history or raw HCS messages, use GET_TOPIC_MESSAGES_QUERY_TOOL
10. Communicate in English`;

  return createAgent({
    model: llm,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: allTools as any,
    systemPrompt,
  });
}
