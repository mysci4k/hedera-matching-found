import { GOALS } from "./goals";
import { fetchTopicMessages } from "./hcs";

export interface GoalState {
  id: string;
  name: string;
  description: string;
  charityAccount: string;
  targetHbar: number;
  sponsors: { label: string; account: string; amount: number }[];
  totalSponsorPool: number;
  totalDonated: number;
  progress: number;
  recentTxId?: string;
}

export async function getGoalsState(): Promise<GoalState[]> {
  const [poolMessages, donationMessages] = await Promise.all([
    fetchTopicMessages(process.env.TOPIC_POOLS!),
    fetchTopicMessages(process.env.TOPIC_DONATIONS!),
  ]);

  return GOALS.map((goal) => {
    const pools = poolMessages.filter(
      (m) => m.type === "POOL_CREATED" && m.goalId === goal.id,
    );
    const donations = donationMessages.filter(
      (m) => m.type === "DONATION_MATCHED" && m.goalId === goal.id,
    );

    const totalSponsorPool = pools.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, p: any) => s + p.amountHbar,
      0,
    );
    const totalDonated = donations.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, d: any) => s + d.totalSent,
      0,
    );
    const lastDonation = donations[donations.length - 1];

    return {
      ...goal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sponsors: pools.map((p: any) => ({
        label: p.sponsorLabel ?? p.sponsorAccount,
        account: p.sponsorAccount,
        amount: p.amountHbar,
      })),
      totalSponsorPool,
      totalDonated,
      progress: Math.min(
        100,
        Math.round((totalDonated / goal.targetHbar) * 100),
      ),
      recentTxId: lastDonation?.txId,
    };
  });
}
