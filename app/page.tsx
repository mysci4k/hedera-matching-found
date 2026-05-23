"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { GoalCard } from "./components/GoalCard";
import { SponsorModal } from "./components/SponsorModal";
import { LiveIndicator } from "./components/LiveIndicator";
import type { GoalState } from "@/lib/mirror-node";

const DonationChat = dynamic(
  () => import("./components/DonationChat").then((m) => m.DonationChat),
  { ssr: false },
);

export default function HomePage() {
  const [goals, setGoals] = useState<GoalState[]>([]);
  const [activeChatGoal, setActiveChatGoal] = useState<string | null>(null);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);
  const goalsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/goals");
        const data = await res.json();
        if (Array.isArray(data)) setGoals(data);
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalSponsorPool = goals.reduce((s, g) => s + g.totalSponsorPool, 0);
  const activeGoal = goals.find((g) => g.id === activeChatGoal);

  function scrollToGoals() {
    goalsRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-black via-zinc-950 to-zinc-900 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,180,0.15),transparent_45%)]" />

        <div className="relative mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
                <LiveIndicator />
                Hedera • Matching Donations Platform
              </div>

              <h1 className="max-w-2xl text-5xl font-black leading-tight tracking-tight lg:text-7xl">
                We Will Double
                <span className="block bg-linear-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                  Your Help!
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-zinc-300">
                Sponsors declare HBAR pools that automatically match user
                donations. Send 2 HBAR → the charity receives 4 HBAR. Powered by
                Hedera Consensus Service.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <button
                  onClick={scrollToGoals}
                  className="rounded-2xl bg-emerald-400 px-7 py-4 text-lg font-semibold text-black shadow-2xl shadow-emerald-500/30 transition hover:scale-[1.02] active:scale-[0.99]"
                >
                  Send HBAR &amp; Multiply Impact
                </button>

                <button
                  onClick={() => setSponsorModalOpen(true)}
                  className="rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-lg font-semibold backdrop-blur transition hover:bg-white/10"
                >
                  Create Sponsor Pool
                </button>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="text-3xl font-bold">
                    {totalSponsorPool > 1000
                      ? `${Math.round(totalSponsorPool / 1000)}k+`
                      : totalSponsorPool}
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">
                    HBAR in sponsor pools
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="text-3xl font-bold">{goals.length || 3}</div>
                  <div className="mt-1 text-sm text-zinc-400">Active goals</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                  <div className="text-3xl font-bold">x2</div>
                  <div className="mt-1 text-sm text-zinc-400">
                    Every donation
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-zinc-400">
                      Live Demo
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      Matching Donation Flow
                    </div>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-4 py-2 text-sm text-emerald-300">
                    Hedera Testnet
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-emerald-500/20 bg-black/30 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          User Donation
                        </div>
                        <div className="mt-1 text-sm text-zinc-400">
                          User sends 2 HBAR
                        </div>
                      </div>
                      <div className="text-3xl font-black text-emerald-300">
                        2 HBAR
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-5xl text-zinc-500">
                    ↓
                  </div>

                  <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          Sponsor Matching
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                          Sponsors add another 2 HBAR
                        </div>
                      </div>
                      <div className="text-3xl font-black text-cyan-300">
                        +2 HBAR
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center text-5xl text-zinc-500">
                    ↓
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/10 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          Transfer on HashScan
                        </div>
                        <div className="mt-1 text-sm text-zinc-300">
                          Charity receives full 4 HBAR
                        </div>
                      </div>
                      <div className="text-4xl font-black text-white">
                        4 HBAR
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-black/40 p-4 font-mono text-sm text-emerald-300">
                      tx: 0.0.4521 → 0.0.9911 • 4 HBAR
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={goalsRef} className="mx-auto max-w-7xl px-6 pb-24">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.25em] text-zinc-500">
              Active Goals
            </div>
            <h2 className="mt-2 text-4xl font-black">
              Sponsors Are Already Doubling Help
            </h2>
          </div>
          <LiveIndicator />
        </div>

        {goals.length === 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-[28px] border border-white/10 bg-white/4 p-6 animate-pulse"
                style={{ height: 380 }}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDonate={setActiveChatGoal}
              />
            ))}
          </div>
        )}
      </section>

      <DonationChat
        goalId={activeChatGoal ?? ""}
        goalName={activeGoal?.name ?? ""}
        isOpen={activeChatGoal !== null}
        onClose={() => setActiveChatGoal(null)}
      />
      <SponsorModal
        isOpen={sponsorModalOpen}
        onClose={() => setSponsorModalOpen(false)}
      />
    </div>
  );
}
