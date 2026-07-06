import "server-only";

import type { ChatContentPart, ChatProvider, ChatProviderMessage } from "../types";
import { collectSystemText, contentPartsToText, nonSystemMessages } from "./provider-format";

type AnthropicContentBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: string;
        data: string;
      };
    };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
};

type AnthropicResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  label: "Anthropic",
  mode: "anthropic",
  available: () => Boolean(process.env.ANTHROPIC_API_KEY),
  async complete(request) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("Anthropic provider is not configured. Add ANTHROPIC_API_KEY server-side to use Claude models.");
    }

    const model = process.env.ANTHROPIC_MODEL || request.modelEntry.apiModel;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0.2,
        system: collectSystemText(request.messages),
        messages: collapseAdjacentMessages(nonSystemMessages(request.messages).map(toAnthropicMessage))
      })
    });

    const data = (await response.json()) as AnthropicResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `Anthropic provider returned ${response.status}.`);
    }

    const text = data.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n\n")
      .trim();

    return {
      model,
      text: text || "The provider returned an empty response."
    };
  }
};

function toAnthropicMessage(message: ChatProviderMessage): AnthropicMessage {
  return {
    role: message.role === "assistant" ? "assistant" : "user",
    content: message.content.flatMap(toAnthropicContentBlock)
  };
}

function toAnthropicContentBlock(part: ChatContentPart): AnthropicContentBlock[] {
  if (part.type === "image") {
    return [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: part.mimeType,
          data: part.data
        }
      }
    ];
  }

  return [
    {
      type: "text",
      text: contentPartsToText([part])
    }
  ];
}

function collapseAdjacentMessages(messages: AnthropicMessage[]) {
  return messages.reduce<AnthropicMessage[]>((collapsed, message) => {
    const previous = collapsed[collapsed.length - 1];

    if (previous && previous.role === message.role) {
      previous.content = [...previous.content, ...message.content];
      return collapsed;
    }

    return [...collapsed, message];
  }, []);
}
