import { Client, PrivateKey } from "@hiero-ledger/sdk";

let _client: Client | null = null;

export function getHederaClient(): Client {
  if (!_client) {
    _client = Client.forTestnet().setOperator(
      process.env.HEDERA_ACCOUNT_ID!,
      PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!),
    );
  }
  return _client;
}
