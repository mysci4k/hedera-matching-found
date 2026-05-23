"use client";

import { useState, useRef, useEffect } from "react";
import { requestSignatureViaWallet } from "@/lib/wallet-connect";

interface Message {
  role: "user" | "agent";
  content: string;
}

interface DonationChatProps {
  goalId: string;
  goalName: string;
  isOpen: boolean;
  onClose: () => void;
}

function formatMessage(text: string) {
  const urlRegex = /(https:\/\/hashscan\.io\/\S+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-400 underline hover:text-emerald-300 break-all"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function DonationChat({
  goalId,
  goalName,
  isOpen,
  onClose,
}: DonationChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      content: `Hello! I can help you donate to "${goalName}" and automatically match your contribution with sponsor funds. Please provide your Hedera account ID and the amount you'd like to donate.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setMessages([
        {
          role: "agent",
          content: `Hello! I can help you donate to "${goalName}" and automatically match your contribution with sponsor funds. Please provide your Hedera account ID and the amount you'd like to donate.`,
        },
      ]);
      setInput("");
    }
  }, [isOpen, goalId, goalName]);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = accountId
      ? `${input} (my account: ${accountId})`
      : input;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const history = newMessages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let agentText = "";

      setMessages((prev) => [...prev, { role: "agent", content: "" }]);

      let requestSignaturePayload: {
        action: "REQUEST_SIGNATURE";
        txBytes: string;
        goalId: string;
        userAmountHbar: number;
        matchedAmount: number;
        sponsorAccount: string;
        charityAccount: string;
        summary: string;
      } | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                agentText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "agent",
                    content: agentText,
                  };
                  return updated;
                });
              }
              if (parsed.action === "REQUEST_SIGNATURE") {
                requestSignaturePayload = parsed;
              }
            } catch {}
          }
        }
      }

      if (!requestSignaturePayload) {
        const jsonMatch = agentText.match(
          /\{[^{}]*"action"\s*:\s*"REQUEST_SIGNATURE"[^{}]*\}/s,
        );
        if (jsonMatch) {
          try {
            requestSignaturePayload = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }

      if (requestSignaturePayload) {
        const {
          txBytes,
          goalId,
          userAmountHbar,
          matchedAmount,
          charityAccount,
        } = requestSignaturePayload;
        const userAccount = accountId.trim();

        if (!userAccount) {
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content:
                "Please enter your Hedera Account ID in the field above so I can open your wallet for signing.",
            },
          ]);
          setIsLoading(false);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content:
              "Opening your wallet to sign the transaction... Please approve in HashPack.",
          },
        ]);

        let signedTxBytes: string;
        try {
          signedTxBytes = await requestSignatureViaWallet(txBytes, userAccount);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (walletErr: any) {
          console.error("[DonationChat] wallet signing failed:", walletErr);
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: `Wallet signing failed: ${walletErr?.message ?? String(walletErr)}. Please try again.`,
            },
          ]);
          setIsLoading(false);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: "Transaction signed! Submitting to the network...",
          },
        ]);

        try {
          const execRes = await fetch("/api/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signedTxBytes,
              goalId,
              userAmountHbar,
              matchedAmount,
              charityAccount,
            }),
          });

          const execData = await execRes.json();

          if (execData.success) {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content: `Donation complete! Your ${userAmountHbar} HBAR donation (plus ${matchedAmount} HBAR matched by the sponsor) has been sent.\n\nView on HashScan: ${execData.hashscanUrl}`,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "agent",
                content: `Transaction failed: ${execData.error ?? "Unknown error"}. Please try again.`,
              },
            ]);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (execErr: any) {
          console.error("[DonationChat] /api/execute error:", execErr);
          setMessages((prev) => [
            ...prev,
            {
              role: "agent",
              content: `Submission failed: ${execErr?.message ?? String(execErr)}. Please try again.`,
            },
          ]);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("[DonationChat] sendMessage error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: `An error occurred: ${err?.message ?? String(err)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-md rounded-[28px] border border-white/10 bg-zinc-950 shadow-2xl flex flex-col"
        style={{ height: "min(600px, 90vh)" }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
          <div>
            <div className="font-bold text-white">AI Donation Agent</div>
            <div className="text-xs text-zinc-400">{goalName}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
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
        </div>

        <div className="border-b border-white/10 px-6 py-3 shrink-0">
          <input
            type="text"
            placeholder="Your Hedera Account ID (e.g. 0.0.1234)"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-400/50"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-500/20 text-white"
                    : "bg-white/[0.07] text-zinc-200"
                }`}
              >
                {msg.role === "agent"
                  ? formatMessage(msg.content)
                  : msg.content}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "agent" && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white/[0.07] px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/10 px-6 py-4 flex gap-3 shrink-0">
          <input
            type="text"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={isLoading}
            className="flex-1 rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed"
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
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
