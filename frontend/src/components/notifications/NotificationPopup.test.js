import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../../i18n/LanguageContext.jsx";
import NotificationPopup from "./NotificationPopup.jsx";

function renderPopup(props) {
  return renderToStaticMarkup(
    createElement(
      LanguageProvider,
      null,
      createElement(NotificationPopup, props),
    ),
  );
}

describe("NotificationPopup", () => {
  it("renders the unread message on a modal", () => {
    const html = renderPopup({
      notification: {
        id: "n1",
        title: "Deposit received",
        body: "50 ETB added",
        createdAt: "2026-09-22T00:00:00.000Z",
      },
      onDismiss: () => {},
    });

    expect(html).toContain("role=\"dialog\"");
    expect(html).toContain("Deposit received");
    expect(html).toContain("50 ETB added");
    expect(html).toContain("OK");
    expect(html).toContain("2147483000");
    expect(html).toContain("pb-24");
    expect(html).toContain("max-h-[85vh]");
  });

  it("renders nothing when there is no notification", () => {
    expect(
      renderPopup({ notification: null, onDismiss: () => {} }),
    ).toBe("");
  });
});
