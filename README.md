# Hedera Matching Donations Platform

**Built for The Hedera AI Agent Bounty — Week 1**

A full-stack Web3 application where sponsors pre-fund HBAR pools that automatically **double every user donation** to charitable causes — settled atomically on Hedera Testnet.

---

## How It Works

1. **Sponsors** create matching pools by depositing HBAR and granting an allowance to the agent account via the UI.
2. **Users** open the AI chat, describe which cause they want to support and how much they want to donate.
3. The **AI agent** checks the available matching pool and confirms the total with the user before proceeding.
4. The user **signs the transaction in their WalletConnect wallet** — a single atomic transfer that moves both the user's HBAR and the sponsor's matched amount to the charity simultaneously.
5. A confirmation record is written to **Hedera Consensus Service (HCS)** as the canonical state.
6. The UI shows a HashScan link and live stats refresh within seconds.

All state (sponsor pools, donation history) is derived purely from HCS topics via Mirror Node — **no external database**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
| AI Agent | LangChain, `@hashgraph/hedera-agent-kit`, Google Gemini |
| Wallet | `@hashgraph/hedera-wallet-connect` (WalletConnect / Reown) |
| Blockchain | Hedera Testnet — HCS + HBAR transfers |
| State | HCS topics + Mirror Node (no DB) |

---

## Project Structure

```
app/
  api/
    agent/       # SSE streaming endpoint — LangChain agent
    execute/     # Co-sign + execute + write HCS
    goals/       # Live goal state from Mirror Node
    sponsor/     # Create sponsor pool (HCS message)
  components/
    DonationChat.tsx   # AI chat UI, WalletConnect trigger
    GoalCard.tsx       # Per-goal progress card
    SponsorModal.tsx   # Sponsor pool creation form
    LiveIndicator.tsx  # Animated live badge
  page.tsx             # Main landing page
lib/
  agent.ts             # LangChain agent + custom tools
  hedera-client.ts     # Hedera SDK client singleton
  hcs.ts               # HCS submit / fetch helpers
  mirror-node.ts       # State reconstruction from HCS
  wallet-connect.ts    # WalletConnect singleton + signing
  goals.ts             # Goal definitions
scripts/
  setup-topics.ts      # One-time HCS topic creation
```

---

## Prerequisites

- Node.js 18+
- A [Hedera Testnet account](https://portal.hedera.com/) for the agent (ECDSA key)
- Three charity Testnet accounts (receive donations)
- One or more sponsor Testnet accounts with HBAR balance
- A [Google AI Studio](https://aistudio.google.com/) API key (Gemini)
- A [Reown](https://cloud.reown.com/) Project ID for WalletConnect

---

## Configuration

Create `.env.local` file and fill in all values:

```env
# Agent account (pays transaction fees, co-signs)
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

**Two-signature transaction flow** — the agent prepares and freezes a single atomic transaction with itself as the fee payer. The user wallet adds their signature via WalletConnect; the backend then co-signs and executes. This allows one transfer to debit both the user and the sponsor allowance simultaneously without any additional on-chain steps.

**No database** — all platform state lives in two HCS topics. The Mirror Node API reconstructs current pool balances and donation history on every request, making the platform fully auditable and censorship-resistant.

**Client-side wallet isolation** — the WalletConnect component is loaded exclusively in the browser to avoid server-side rendering conflicts with wallet session storage.
