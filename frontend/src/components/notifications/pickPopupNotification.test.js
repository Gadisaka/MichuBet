import { describe, expect, it } from "vitest";
import { translate } from "../../i18n/coreTranslations.js";
import { pickPopupNotification } from "./pickPopupNotification.js";

const newer = { id: "n2", title: "Second", body: "B" };
const older = { id: "n1", title: "First", body: "A" };

describe("pickPopupNotification", () => {
  it("returns the newest unread item", () => {
    expect(pickPopupNotification([newer, older], new Set(), false)).toEqual(
      newer,
    );
  });

  it("skips dismissed ids so the next unread is shown", () => {
    expect(
      pickPopupNotification([newer, older], new Set(["n2"]), false),
    ).toEqual(older);
  });

  it("hides while the inbox is open", () => {
    expect(pickPopupNotification([newer], new Set(), true)).toBeNull();
  });

  it("returns null when every unread item was dismissed", () => {
    expect(
      pickPopupNotification([newer, older], new Set(["n1", "n2"]), false),
    ).toBeNull();
  });
});

describe("notification popup copy", () => {
  it("has OK labels in English and Amharic", () => {
    expect(translate("en", "notifications.ok")).toBe("OK");
    expect(translate("am", "notifications.ok")).toBe("እሺ");
  });
});
