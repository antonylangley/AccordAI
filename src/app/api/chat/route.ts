import { NextResponse } from "next/server";
import { ChatGatewayInputError, runChatGateway } from "@/lib/chat/gateway";
import { getModelOptions } from "@/lib/chat/model-registry";
import { getChatProvider, getProviderConfiguration, ProviderUnavailableError } from "@/lib/chat/providers";
import { persistChatGatewayRun } from "@/lib/db/accord-store";

export const runtime = "nodejs";

export function GET() {
  const provider = getChatProvider();

  return NextResponse.json(
    {
      provider: {
        id: provider.id,
        label: provider.label,
        mode: provider.mode,
        openAIConfigured: Boolean(process.env.OPENAI_API_KEY)
      },
      configuredProviders: getProviderConfiguration(),
      models: getModelOptions(),
      loggingBehavior: {
        rawPromptStored: false,
        rawResponseStored: false,
        note: "Governance without surveillance: Accord keeps metadata and redacted previews by default."
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await runChatGateway(body);
    await persistChatGatewayRun(body, response);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const status = error instanceof ChatGatewayInputError || error instanceof ProviderUnavailableError ? 400 : 500;

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Chat gateway failed."
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
