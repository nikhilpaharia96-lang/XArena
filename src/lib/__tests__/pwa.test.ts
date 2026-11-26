import { describe, expect, it } from "vitest";
import { MAX_INSTALL_PROMPTS, REPROMPT_AFTER_MS, shouldShowInstall, urlBase64ToUint8Array } from "../pwa";

const DAY = 24 * 3600_000;

describe("shouldShowInstall", () => {
  it("shows on first login (no saved state)", () => expect(shouldShowInstall(null, Date.now())).toBe(true));

  it("doesn't re-nag right after it was shown, but once more after the wait", () => {
    const t = Date.now();
    expect(shouldShowInstall({ count: 1, lastShownAt: t - DAY }, t)).toBe(false);
    expect(shouldShowInstall({ count: 1, lastShownAt: t - REPROMPT_AFTER_MS }, t)).toBe(true);
  });

  it("stops after the maximum number of prompts, and never after installing", () => {
    const t = Date.now();
    expect(shouldShowInstall({ count: MAX_INSTALL_PROMPTS, lastShownAt: t - 30 * DAY }, t)).toBe(false);
    expect(shouldShowInstall({ count: 0, lastShownAt: 0, installed: true }, t)).toBe(false);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 with missing padding", () => {
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
  });
});
