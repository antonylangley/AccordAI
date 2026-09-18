import { describe, expect, test, vi } from "vitest";
import { ensureAccordCompanyExists } from "./company-record";

describe("organization record initialization", () => {
  test("does not overwrite an existing organization name", async () => {
    const company = { slug: "test-company", name: "Antony Inc." };
    const upsert = vi.fn(async (value, options) => {
      if (!options.ignoreDuplicates || company.slug !== value.slug) {
        company.name = value.name;
      }
      return { error: null };
    });
    const supabase = {
      from: vi.fn(() => ({ upsert }))
    };

    await ensureAccordCompanyExists(
      supabase as never,
      "test-company",
      "Test Company"
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "test-company", name: "Test Company" }),
      { onConflict: "slug", ignoreDuplicates: true }
    );
    expect(company.name).toBe("Antony Inc.");
  });
});
