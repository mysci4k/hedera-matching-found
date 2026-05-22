import { Client, PrivateKey, TopicCreateTransaction } from "@hiero-ledger/sdk";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const client = Client.forTestnet().setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!),
);

async function main() {
  const poolsTx = await new TopicCreateTransaction()
    .setTopicMemo("matching-donations-pools-v1")
    .execute(client);
  const poolsReceipt = await poolsTx.getReceipt(client);
  console.log("TOPIC_POOLS=" + poolsReceipt.topicId!.toString());

  const donationsTx = await new TopicCreateTransaction()
    .setTopicMemo("matching-donations-donations-v1")
    .execute(client);
  const donationsReceipt = await donationsTx.getReceipt(client);
  console.log("TOPIC_DONATIONS=" + donationsReceipt.topicId!.toString());

  console.log("\nAdd the above lines to your .env.local file.");
  process.exit(0);
}

main().catch(console.error);
