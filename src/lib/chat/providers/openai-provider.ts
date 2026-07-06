import "server-only";

import type { ChatContentPart, ChatProvider, ChatProviderMessage } from "../types";
import { contentPartsToText } from "./provider-format";

type OpenAIChatCompletion = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type OpenAIMessageContent =
  | string
  | OpenAIContentPart[];

type OpenAIContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: OpenAIMessageContent;
};

export const openAIProvider: ChatProvider = {
  id: "openai",
  label: "OpenAI",
  mode: "openai",
  available: () => Boolean(process.env.OPENAI_API_KEY),
  async complete(request) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI provider is not configured.");
    }

    const model = process.env.OPENAI_MODEL || request.modelEntry.apiModel;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: request.messages.map(toOpenAIMessage)
      })
    });

    const data = (await response.json()) as OpenAIChatCompletion;

    if (!response.ok) {
      throw new Error(data.error?.message || `OpenAI provider returned ${response.status}.`);
    }

    return {
      model,
      text: data.choices?.[0]?.message?.content?.trim() || "The provider returned an empty response."
    };
  }
};

function toOpenAIMessage(message: ChatProviderMessage): OpenAIMessage {
  if (message.role === "system" || !message.content.some((part) => part.type === "image")) {
    return {
      role: message.role,
      content: contentPartsToText(message.content)
    };
  }

  return {
    role: message.role,
    content: message.content.flatMap(toOpenAIContentPart)
  };
}

function toOpenAIContentPart(part: ChatContentPart): OpenAIContentPart[] {
  if (part.type === "image") {
    return [
      {
        type: "image_url",
        image_url: {
          url: `data:${part.mimeType};base64,${part.data}`
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
