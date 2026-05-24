# Hedera Matching Donations Platform - HBARImpact

**Built for The Hedera AI Agent Bounty — Week 1**

A full-stack Web3 application where sponsors pre-fund HBAR pools that automatically **double every user donation** to charitable causes — settled on Hedera Testnet via an AI agent.

---

## How It Works

1. **Sponsors** create matching pools by depositing HBAR and granting an HBAR allowance to the agent operator account via the UI.
2. **Users** open the AI chat, describe which cause they want to support and how much they want to donate.
3. The **AI agent** checks the available matching pool and confirms the total with the user before proceeding.
4. The user **signs the user-side transaction in their WalletConnect wallet** (user → charity).
5. After wallet confirmation, the agent **autonomously executes the sponsor matching transfer** (sponsor → charity) using the pre-approved allowance — no second wallet signature required.
6. The agent **writes a `DONATION_MATCHED` record to HCS** as the canonical state.
7. The agent replies with plain-text **Hashscan links** to both transactions.

All state (sponsor pools, donation history) is derived purely from HCS topics via Mirror Node — **no external database**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| AI Agent | LangChain, `@hashgraph/hedera-agent-kit` + `hedera-agent-kit-langchain`, Google Gemini (`gemini-3.1-flash-lite`) |
| Wallet | `@hashgraph/hedera-wallet-connect` (WalletConnect / Reown) |
| Blockchain | Hedera Testnet — HCS + HBAR transfers + allowances |
| State | HCS topics + Mirror Node (no DB) |

---

## hedera-agent-kit Plugins Used

The agent is initialized with the following official `@hashgraph/hedera-agent-kit` plugins via `HederaLangchainToolkit`:

| Plugin | Tools provided | Used for |
|---|---|---|
| `coreAccountPlugin` | `transfer_hbar_with_allowance_tool`, `approve_hbar_allowance_tool`, … | Executing the sponsor matching transfer using the pre-approved allowance |
| `coreAccountQueryPlugin` | `get_hbar_balance_query_tool`, … | Verifying account balances before donation |
| `coreConsensusPlugin` | `submit_topic_message_tool`, `create_topic_tool`, … | Writing `DONATION_MATCHED` events to HCS |
| `coreConsensusQueryPlugin` | `get_topic_messages_query_tool`, `get_topic_info_query_tool`, … | Reading raw pool/donation messages from HCS topics |
| `coreTransactionQueryPlugin` | `get_transaction_record_query_tool`, … | Verifying user transaction status by ID |

In addition, two custom `DynamicStructuredTool` tools are registered:

| Tool | Description |
|---|---|
| `check_matching_pool` | Aggregates HCS data to return available matching balance for a goal |
| `prepare_user_donation` | Builds and freezes the user-side transfer transaction; returns serialized bytes for WalletConnect signing |

---

## Donation Flow (Two Separate Transactions)

```
User wallet  ──[signs]──►  user → charity          (WalletConnect, TransferTransaction)
Agent operator ──[allowance]──►  sponsor → charity  (transfer_hbar_with_allowance_tool)
Agent operator ──►  HCS topic                       (submit_topic_message_tool, DONATION_MATCHED)
```

The sponsor grants an HBAR allowance to the operator account once (via the Sponsor UI). After that, the agent can execute matching transfers autonomously for every confirmed user donation.

---

## Project Structure

```
app/
  api/
    agent/       # SSE streaming endpoint — LangChain agent
    execute/     # Co-sign + submit user transaction; returns txId + hashscanUrl
    goals/       # Live goal state from Mirror Node
    sponsor/     # Create sponsor pool (HCS message + allowance)
  components/
    DonationChat.tsx   # AI chat UI, WalletConnect trigger, auto-message after execute
    GoalCard.tsx       # Per-goal progress card
    SponsorModal.tsx   # Sponsor pool creation form
    LiveIndicator.tsx  # Animated live badge
  page.tsx             # Main landing page
lib/
  agent.ts             # LangChain agent, plugins, custom tools, Gemini schema sanitizer
  hedera-client.ts     # Hedera SDK client singleton
  hcs.ts               # HCS submit / fetch helpers
  mirror-node.ts       # State reconstruction from HCS topics
  wallet-connect.ts    # WalletConnect singleton + signing
  goals.ts             # Goal definitions (shelter, education, flood)
scripts/
  setup-topics.ts      # One-time HCS topic creation
```

---

## Prerequisites

- Node.js 18+
- A [Hedera Testnet account](https://portal.hedera.com/) for the agent operator (ECDSA key)
- Three charity Testnet accounts (receive donations)
- One or more sponsor Testnet accounts with HBAR balance and an approved allowance for the operator
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Reown](https://cloud.reown.com/) Project ID for WalletConnect

---

## Configuration

Create `.env.local` and fill in all values:

```env
# Agent operator account (pays transaction fees, co-signs, executes allowance transfers)
HEDERA_ACCOUNT_ID="0.0.XXXXX"
HEDERA_PRIVATE_KEY="<ECDSA hex private key>"

# Hedera network
MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"

# HCS topics (created by setup script)
TOPIC_POOLS="0.0.XXXXX"
TOPIC_DONATIONS="0.0.XXXXX"

# Charity accounts
CHARITY_SHELTER="0.0.XXXXX"
CHARITY_EDUCATION="0.0.XXXXX"
CHARITY_FLOOD="0.0.XXXXX"

# AI
GOOGLE_API_KEY="<gemini api key>"

# WalletConnect / Reown
NEXT_PUBLIC_REOWN_PROJECT_ID="<reown project id>"
NEXT_PUBLIC_AGENT_ACCOUNT="0.0.XXXXX"
```

### Create HCS topics

Run once to create the two required topics on Testnet:

```bash
npm run setup
```

This outputs the topic IDs — paste them into `.env.local`.

---

## Running

```bash
npm install
npm run dev      # development with Turbopack
npm run build    # production build
npm start        # production server
```

---

## Key Design Decisions

**Two separate transactions** — the user signs only their own transfer (user → charity) via WalletConnect. The agent then autonomously executes the sponsor's matching transfer using a pre-approved HBAR allowance (`transfer_hbar_with_allowance_tool`). This avoids requiring the sponsor to be online for every donation.

**Gemini schema sanitizer** — `@hashgraph/hedera-agent-kit` uses Zod schemas with `.optional()` / `.nullable()` fields. These produce `anyOf` unions and `"type": ["string", "null"]` arrays in JSON Schema, which the Gemini API rejects. `lib/agent.ts` converts each tool's Zod schema to plain JSON Schema via `toJsonSchema()` and strips all incompatible constructs before binding tools to the LLM.

**No database** — all platform state lives in two HCS topics. The Mirror Node API reconstructs current pool balances and donation history on every request, making the platform fully auditable and censorship-resistant.

**Client-side wallet isolation** — the WalletConnect component is loaded exclusively in the browser to avoid server-side rendering conflicts with wallet session storage.
