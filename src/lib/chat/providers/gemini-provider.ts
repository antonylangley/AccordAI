import "server-only";

import type { ChatContentPart, ChatProvider, ChatProviderMessage } from "../types";
import { collectSystemText, contentPartsToText, nonSystemMessages } from "./provider-format";

type GeminiPart =
  | {
      text: string;
    }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export const geminiProvider: ChatProvider = {
  id: "gemini",
  label: "Gemini",
  mode: "gemini",
  available: () => Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  async complete(request) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini provider is not configured. Add GEMINI_API_KEY or GOOGLE_API_KEY server-side to use Gemini models.");
    }

    const model = process.env.GEMINI_MODEL || request.modelEntry.apiModel;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: collectSystemText(request.messages) }]
          },
          contents: collapseAdjacentContents(nonSystemMessages(request.messages).map(toGeminiContent)),
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `Gemini provider returned ${response.status}.`);
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    return {
      model,
      text: text || "The provider returned an empty response."
    };
  }
};

function toGeminiContent(message: ChatProviderMessage): GeminiContent {
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: message.content.flatMap(toGeminiPart)
  };
}

function toGeminiPart(part: ChatContentPart): GeminiPart[] {
  if (part.type === "image") {
    return [
      {
        inlineData: {
          mimeType: part.mimeType,
          data: part.data
        }
      }
    ];
  }

  return [
    {
      text: contentPartsToText([part])
    }
  ];
}

function collapseAdjacentContents(contents: GeminiContent[]) {
  return contents.reduce<GeminiContent[]>((collapsed, content) => {
    const previous = collapsed[collapsed.length - 1];

    if (previous && previous.role === content.role) {
      previous.parts = [...previous.parts, ...content.parts];
      return collapsed;
    }

    return [...collapsed, content];
  }, []);
}
