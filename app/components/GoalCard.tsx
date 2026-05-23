"use client";

import type { GoalState } from "@/lib/mirror-node";

interface GoalCardProps {
  goal: GoalState;
  onDonate: (goalId: string) => void;
}

export function GoalCard({ goal, onDonate }: GoalCardProps) {
  return (
    <div className="group flex flex-col rounded-[28px] border border-white/10 bg-white/4 p-6 backdrop-blur transition hover:-translate-y-1 hover:border-emerald-400/30 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{goal.name}</div>
          <div className="mt-2 text-sm text-zinc-400">{goal.description}</div>
        </div>
        <div className="ml-4 shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
          x2 ACTIVE
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {goal.sponsors.length === 0 ? (
          <div className="rounded-2xl bg-black/30 p-4 text-sm text-zinc-500 italic">
            No sponsors yet
          </div>
        ) : (
          goal.sponsors.map((sponsor, i) => (
            <div key={i} className="rounded-2xl bg-black/30 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 font-medium">
                  {sponsor.label}
                </span>
                <span className="font-semibold text-white">
                  {sponsor.amount.toLocaleString()} HBAR
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-zinc-400">Raised</span>
          <span className="font-semibold">
            {goal.totalDonated.toLocaleString()} HBAR
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-300 to-cyan-400 transition-all duration-700"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
          <span>{goal.progress}%</span>
          <span>Goal: {goal.targetHbar.toLocaleString()} HBAR</span>
        </div>
      </div>

      {goal.recentTxId && (
        <div className="mt-4">
          <a
            href={`https://hashscan.io/testnet/transaction/${goal.recentTxId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 text-xs font-mono text-emerald-400 hover:text-emerald-300 underline truncate block"
          >
            Latest tx: {goal.recentTxId.slice(0, 30)}…
          </a>
        </div>
      )}

      <button
        onClick={() => onDonate(goal.id)}
        className="mt-auto w-full rounded-2xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-emerald-300 active:scale-[0.98]"
      >
        Support &amp; Double Your Donation
      </button>
    </div>
  );
}
