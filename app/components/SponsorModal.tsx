"use client";

import { useState } from "react";
import { GOALS } from "@/lib/goals";

type Step = "form" | "confirm" | "connecting" | "success" | "error";

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AGENT_ACCOUNT =
  process.env.NEXT_PUBLIC_AGENT_ACCOUNT ?? "the agent account";

export function SponsorModal({ isOpen, onClose }: SponsorModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [goalId, setGoalId] = useState(GOALS[0].id);
  const [sponsorAccount, setSponsorAccount] = useState("");
  const [sponsorLabel, setSponsorLabel] = useState("");
  const [amountHbar, setAmountHbar] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [txId, setTxId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const selectedGoal = GOALS.find((g) => g.id === goalId);

  function handleClose() {
    setStep("form");
    setSponsorAccount("");
    setSponsorLabel("");
    setAmountHbar("");
    setGoalId(GOALS[0].id);
    setStatusMsg("");
    setTxId("");
    setErrorMsg("");
    onClose();
  }

  function handleFormSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setStep("confirm");
  }

  async function handleApproveAndRegister() {
    setStep("connecting");
    setStatusMsg("Opening wallet connection…");

    try {
      const { approveAllowanceViaWallet } =
        await import("@/lib/wallet-connect");

      setStatusMsg("Waiting for wallet connection via QR code…");
      const resultTxId = await approveAllowanceViaWallet(
        sponsorAccount,
        AGENT_ACCOUNT,
        Number(amountHbar),
      );

      setStatusMsg("Allowance approved! Registering sponsor pool on HCS…");

      const res = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          sponsorAccount,
          sponsorLabel: sponsorLabel || sponsorAccount,
          amountHbar: Number(amountHbar),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to register on HCS");

      setTxId(resultTxId);
      setStep("success");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setErrorMsg(err.message ?? "An unexpected error occurred.");
      setStep("error");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-lg rounded-[28px] border border-white/10 bg-zinc-950 p-8 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-6 top-6 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {step === "form" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">
                Create Sponsor Pool
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Declare an HBAR pool that automatically matches user donations.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Charitable Goal
                </label>
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-1 focus:ring-emerald-400/50"
                >
                  {GOALS.map((g) => (
                    <option key={g.id} value={g.id} className="bg-zinc-900">
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Sponsor Account ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0.0.5678"
                  value={sponsorAccount}
                  onChange={(e) => setSponsorAccount(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Sponsor Label{" "}
                  <span className="text-zinc-500">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={sponsorLabel}
                  onChange={(e) => setSponsorLabel(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Amount (HBAR)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 10000"
                  value={amountHbar}
                  onChange={(e) => setAmountHbar(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-400/50"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-400 px-6 py-4 font-semibold text-black transition hover:bg-emerald-300"
              >
                Continue →
              </button>
            </form>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">
                Confirm &amp; Connect Wallet
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Review the details, then connect your HashPack wallet to approve
                the allowance.
              </p>
            </div>

            <div className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-white/4 p-5">
              <Row label="Goal" value={selectedGoal?.name ?? goalId} />
              <Row label="Sponsor Account" value={sponsorAccount} mono />
              {sponsorLabel && (
                <Row label="Sponsor Label" value={sponsorLabel} />
              )}
              <Row
                label="Amount"
                value={`${Number(amountHbar).toLocaleString()} HBAR`}
              />
              <Row label="Spender (Agent)" value={AGENT_ACCOUNT} mono />
            </div>

            <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-emerald-300 mb-2">
                What will happen:
              </p>
              <ol className="space-y-1 text-sm text-zinc-300 list-decimal list-inside">
                <li>
                  A QR code will appear — scan it with <strong>HashPack</strong>{" "}
                  mobile app
                </li>
                <li>
                  HashPack will ask you to approve a{" "}
                  <code className="text-emerald-400 font-mono text-xs">
                    CryptoApproveAllowance
                  </code>{" "}
                  transaction
                </li>
                <li>
                  After you confirm, the sponsor pool is registered on Hedera
                  Consensus Service
                </li>
              </ol>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("form")}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-semibold text-white transition hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                onClick={handleApproveAndRegister}
                className="flex-1 rounded-2xl bg-emerald-400 px-6 py-4 font-semibold text-black transition hover:bg-emerald-300"
              >
                Connect Wallet &amp; Approve
              </button>
            </div>
          </>
        )}

        {step === "connecting" && (
          <div className="py-6 text-center">
            <div className="mb-6 flex justify-center">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-emerald-400/20 border-t-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Waiting for Wallet
            </h2>
            <p className="text-sm text-zinc-400">{statusMsg}</p>
            <p className="mt-4 text-xs text-zinc-600">
              Scan the QR code that appeared with your{" "}
              <strong className="text-zinc-400">HashPack</strong> mobile app, or
              approve in the browser extension.
            </p>
          </div>
        )}

        {step === "success" && (
          <div className="py-4 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-white mb-2">
              Sponsor Pool Created!
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Allowance approved on-chain and pool registered on Hedera
              Consensus Service. It will appear in the UI within a few seconds.
            </p>
            {txId && (
              <a
                href={`https://hashscan.io/testnet/transaction/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-6 block truncate rounded-2xl bg-black/30 px-4 py-3 font-mono text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                View on HashScan ↗
              </a>
            )}
            <button
              onClick={handleClose}
              className="rounded-2xl bg-emerald-400 px-6 py-3 font-semibold text-black hover:bg-emerald-300 transition"
            >
              Close
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="py-4 text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h2>
            <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400 text-left wrap-break-words">
              {errorMsg}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("confirm")}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Try Again
              </button>
              <button
                onClick={handleClose}
                className="flex-1 rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500 shrink-0">{label}</span>
      <span
        className={`text-sm font-medium text-white text-right truncate ${
          mono ? "font-mono text-emerald-400 text-xs" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
