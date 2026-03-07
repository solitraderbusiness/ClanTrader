import { describe, it, expect } from "vitest";
import { getInitials } from "../utils";

describe("getInitials", () => {
  it("returns first letter of each word for two-word names", () => {
    expect(getInitials("Golden Eagles")).toBe("GE");
    expect(getInitials("Alpha Wolf")).toBe("AW");
  });

  it("handles lowercase input", () => {
    expect(getInitials("forex traders")).toBe("FT");
  });

  it("returns two letters max for names with 3+ words", () => {
    expect(getInitials("The Best Clan Ever")).toBe("TB");
  });

  it("returns single letter for single-word names", () => {
    expect(getInitials("Golden")).toBe("G");
  });

  it("handles extra spaces", () => {
    expect(getInitials("  Golden   Eagles  ")).toBe("GE");
  });

  it("handles single character input", () => {
    expect(getInitials("?")).toBe("?");
  });
});
