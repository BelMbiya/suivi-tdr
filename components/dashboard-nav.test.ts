import { describe, expect, it } from "vitest";
import { visibleNavigation } from "@/components/dashboard-nav";
import type { CurrentUser } from "@/types/domain";

const fieldUser: CurrentUser = {
  id: "1",
  organizationId: "org",
  email: "agent@test.local",
  roles: ["USER"],
  areaIds: ["area-1"],
};

const manager: CurrentUser = {
  ...fieldUser,
  email: "manager@test.local",
  roles: ["MANAGER"],
};

describe("visibleNavigation", () => {
  it("shows nothing while auth is loading", () => {
    expect(visibleNavigation(undefined, true)).toEqual([]);
  });

  it("shows only Mon suivi for field users", () => {
    const items = visibleNavigation(fieldUser, false);
    expect(items).toHaveLength(1);
    expect(items[0]?.href).toBe("/track");
  });

  it("shows manager pages for managers", () => {
    const items = visibleNavigation(manager, false);
    expect(items.some((item) => item.href === "/map")).toBe(true);
    expect(items.some((item) => item.href === "/audit-logs")).toBe(false);
  });
});
