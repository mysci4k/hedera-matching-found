import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
  transactionToBase64String,
} from "@hashgraph/hedera-wallet-connect";
import {
  AccountAllowanceApproveTransaction,
  AccountId,
  Client,
  Hbar,
  LedgerId,
  Transaction,
  TransactionId,
} from "@hiero-ledger/sdk";

const PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID!;

const METADATA = {
  name: "Hedera Matching Donations",
  description:
    "Charitable giving platform – sponsors automatically match HBAR donations.",
  url:
    typeof window !== "undefined"
      ? window.location.origin
      : "https://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/31002956"],
};

let _connector: DAppConnector | null = null;

function isUserRejection(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("reject") ||
    msg.includes("cancel") ||
    msg.includes("abort") ||
    msg.includes("user denied") ||
    msg.includes("closed") ||
    msg.includes("disconnect") ||
    msg.includes("modal closed") ||
    msg.includes("session deleted") ||
    msg.includes("expired")
  );
}

export async function getDAppConnector(): Promise<DAppConnector> {
  if (_connector) return _connector;

  const connector = new DAppConnector(
    METADATA,
    LedgerId.TESTNET,
    PROJECT_ID,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet],
  );

  await connector.init({ logger: "error" });

  connector.walletConnectClient?.on("session_delete", () => {
    console.log(
      "[WalletConnect] session_delete – resetting connector singleton",
    );
    _connector = null;
  });

  _connector = connector;
  return connector;
}

export async function approveAllowanceViaWallet(
  sponsorAccountId: string,
  spenderAccountId: string,
  amountHbar: number,
): Promise<string> {
  const connector = await getDAppConnector();

  try {
    await connector.openModal();
  } catch (err) {
    _connector = null;
    if (isUserRejection(err)) {
      throw new Error("Wallet connection cancelled. Please try again.");
    }
    throw err;
  }

  const freezeClient = Client.forTestnet();

  const tx = new AccountAllowanceApproveTransaction()
    .approveHbarAllowance(
      AccountId.fromString(sponsorAccountId),
      AccountId.fromString(spenderAccountId),
      new Hbar(amountHbar),
    )
    .setTransactionId(
      TransactionId.generate(AccountId.fromString(sponsorAccountId)),
    )
    .freezeWith(freezeClient);

  try {
    const result = await connector.signAndExecuteTransaction({
      signerAccountId: `hedera:testnet:${sponsorAccountId}`,
      transactionList: transactionToBase64String(tx),
    });
    return result.result?.transactionId ?? "";
  } catch (err) {
    _connector = null;
    if (isUserRejection(err)) {
      throw new Error("Transaction rejected in wallet. Please try again.");
    }
    throw err;
  }
}

export async function requestSignatureViaWallet(
  txBase64: string,
  userAccountId: string,
): Promise<string> {
  const connector = await getDAppConnector();

  const alreadyConnected = connector.signers.some(
    (s) => s.getAccountId().toString() === userAccountId,
  );

  if (!alreadyConnected) {
    const extensions = connector.extensions ?? [];
    const hashpack = extensions.find((e) =>
      e.name?.toLowerCase().includes("hashpack"),
    );

    try {
      if (hashpack?.id) {
        await connector.connectExtension(hashpack.id);
      } else {
        await connector.openModal();
      }
    } catch (err) {
      _connector = null;
      if (isUserRejection(err)) {
        throw new Error("Wallet connection cancelled. Please try again.");
      }
      throw err;
    }
  }

  const txBytes = Buffer.from(txBase64, "base64");
  const tx = Transaction.fromBytes(txBytes);

  try {
    const result = await connector.signTransaction({
      signerAccountId: `hedera:testnet:${userAccountId}`,
      transactionBody: tx,
    });

    const signedTx = result instanceof Transaction ? result : tx;
    return Buffer.from(signedTx.toBytes()).toString("base64");
  } catch (err) {
    _connector = null;
    if (isUserRejection(err)) {
      throw new Error("Transaction rejected in wallet. Please try again.");
    }
    throw err;
  }
}
