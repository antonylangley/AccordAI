import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { WhyPopover } from "./WhyPopover";
import type { SurfaceSnapshot } from "../state/surface-state";

describe("WhyPopover", () => {
  test("uses a specific blocked message instead of generic prompt copy", () => {
    const html = renderToStaticMarkup(
      <WhyPopover
        markUrl="mark.png"
        onClose={() => undefined}
        state={
          {
            phase: "blocked",
            draftText: "",
            whyOpen: true,
            attachmentNotice: false,
            message:
              "PDF redaction is not active in browser mode yet. resume.pdf was not uploaded. Use Accord Workspace for governed resume or document analysis."
          } satisfies SurfaceSnapshot
        }
      />
    );

    expect(html).toContain("PDF redaction is not active in browser mode yet");
    expect(html).not.toContain("This value cannot be submitted to an external AI tool");
  });
});
