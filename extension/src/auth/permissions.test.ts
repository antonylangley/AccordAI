import { describe, expect, test } from "vitest";
import {
  canDeleteOrganization,
  canEditOrganization,
  canManageMembers,
  canManagePolicies,
  type AccordRole
} from "../../../src/lib/auth/permissions";

describe("Accord role permissions", () => {
  test.each([
    ["owner", true, true, true, true],
    ["admin", true, true, true, false],
    ["member", false, false, false, false],
    ["viewer", false, false, false, false]
  ] satisfies Array<[AccordRole, boolean, boolean, boolean, boolean]>)(
    "%s permissions are explicit",
    (role, editOrganization, managePolicies, manageMembers, deleteOrganization) => {
      expect(canEditOrganization(role)).toBe(editOrganization);
      expect(canManagePolicies(role)).toBe(managePolicies);
      expect(canManageMembers(role)).toBe(manageMembers);
      expect(canDeleteOrganization(role)).toBe(deleteOrganization);
    }
  );
});
