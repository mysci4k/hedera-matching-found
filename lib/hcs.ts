import { Client, TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";

export interface PoolCreatedMessage {
  type: "POOL_CREATED";
  goalId: string;
  sponsorAccount: string;
  sponsorLabel: string;
  amountHbar: number;
  timestamp: number;
}

export interface DonationMatchedMessage {
  type: "DONATION_MATCHED";
  goalId: string;
  userAmount: number;
  matchedAmount: number;
  totalSent: number;
  charityAccount: string;
  txId: string;
  timestamp: number;
}

export async function submitHCSMessage(
  client: Client,
  topicId: string,
  payload: PoolCreatedMessage | DonationMatchedMessage,
): Promise<void> {
  await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(payload))
    .execute(client);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTopicMessages(topicId: string): Promise<any[]> {
  const url = `${process.env.MIRROR_NODE_URL}/api/v1/topics/${topicId}/messages?limit=100&order=asc`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.messages ?? []).map((m: any) =>
    JSON.parse(Buffer.from(m.message, "base64").toString("utf-8")),
  );
}
