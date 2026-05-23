import { createMatchingAgent } from "@/lib/agent";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export async function POST(req: Request) {
  const { message, history } = await req.json();

  if (!message) {
    return new Response("Missing message", { status: 400 });
  }

  const agent = createMatchingAgent();
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const langchainHistory = (history ?? []).map(
    (m: { role: string; content: string }) =>
      m.role === "user"
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
  );

  (async () => {
    try {
      const eventStream = agent.streamEvents(
        { messages: [...langchainHistory, new HumanMessage(message)] },
        { version: "v2" },
      );

      for await (const event of eventStream) {
        if (event.event === "on_tool_end" && event.data?.output) {
          const raw = event.data.output;
          const content: string | null =
            typeof raw === "string"
              ? raw
              : typeof raw?.kwargs?.content === "string"
                ? raw.kwargs.content
                : typeof raw?.content === "string"
                  ? raw.content
                  : null;

          if (content) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.action === "REQUEST_SIGNATURE") {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`),
                );
              }
            } catch {}
          }
        }

        if (
          event.event === "on_chat_model_stream" &&
          event.data?.chunk?.content
        ) {
          const chunk = event.data.chunk.content;
          if (typeof chunk === "string" && chunk) {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`),
            );
          }
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({ text: `Error: ${err.message}` })}\n\n`,
        ),
      );
    } finally {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
