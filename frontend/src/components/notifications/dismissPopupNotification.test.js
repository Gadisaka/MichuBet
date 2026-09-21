import { describe, expect, it, vi } from "vitest";
import { dismissPopupNotification } from "./dismissPopupNotification.js";

describe("dismissPopupNotification", () => {
  it("marks the notification read and keeps the id dismissed", async () => {
    const dismissedIds = new Set();
    const markRead = vi.fn().mockResolvedValue({ ok: true });

    const result = await dismissPopupNotification({
      id: "n1",
      dismissedIds,
      markRead,
    });

    expect(result).toEqual({ marked: true });
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(dismissedIds.has("n1")).toBe(true);
  });

  it("allows the popup again when mark-read fails", async () => {
    const dismissedIds = new Set();
    const markRead = vi.fn().mockRejectedValue(new Error("offline"));

    const result = await dismissPopupNotification({
      id: "n1",
      dismissedIds,
      markRead,
    });

    expect(result).toEqual({ marked: false });
    expect(dismissedIds.has("n1")).toBe(false);
  });
});
