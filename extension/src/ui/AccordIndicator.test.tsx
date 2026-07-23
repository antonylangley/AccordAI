import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AccordIndicator } from "./AccordIndicator";
import type { SurfaceSnapshot } from "../state/surface-state";

describe("AccordIndicator", () => {
  test("labels successful redacted attachments as protected uploads", () => {
    const html = render(
      {
        phase: "redact",
        draftText: "",
        whyOpen: false,
        attachmentNotice: true,
        attachmentRedactionCount: 2
      }
    );

    expect(html).toContain("Upload protected");
    expect(html).not.toContain("Upload blocked");
  });

  test("keeps blocked attachment state explicit", () => {
    const html = render(
      {
        phase: "blocked",
        draftText: "",
        whyOpen: false,
        attachmentNotice: true,
        message: "Accord could not verify the governed attachment. File was not uploaded."
      }
    );

    expect(html).toContain("Upload blocked");
  });
});

function render(state: SurfaceSnapshot) {
  return renderToStaticMarkup(<AccordIndicator state={state} markUrl="mark.png" onWhy={() => undefined} />);
}
