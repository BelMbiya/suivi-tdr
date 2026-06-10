import { describe, expect, it } from "vitest";
import { defaultPathForRoles, resolvePostLoginPath } from "@/lib/auth/redirect";

describe("auth redirect helpers", () => {
  it("sends field users to /track", () => {
    expect(defaultPathForRoles(["USER"])).toBe("/track");
    expect(resolvePostLoginPath(["USER"], "/dashboard")).toBe("/track");
  });

  it("sends managers to dashboard by default", () => {
    expect(defaultPathForRoles(["MANAGER"])).toBe("/dashboard");
    expect(resolvePostLoginPath(["MANAGER"], null)).toBe("/dashboard");
  });

  it("honors safe next paths for managers", () => {
    expect(resolvePostLoginPath(["MANAGER"], "/map")).toBe("/map");
  });
});
