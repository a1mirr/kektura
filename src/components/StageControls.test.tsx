// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import StageControls from "./StageControls";

afterEach(cleanup);

const setup = (withRetired?: boolean) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StageControls withRetired={withRetired} />
    </NextIntlClientProvider>,
  );

describe("spec 0001: the stage controls", () => {
  it("AC-24: the 'Show retired stamps' checkbox exists only while there is a retired stamp", () => {
    setup(false);
    expect(screen.queryByLabelText("Show retired stamps")).toBeNull();
    cleanup();
    setup();
    expect(screen.queryByLabelText("Show retired stamps")).toBeNull();
    cleanup();
    setup(true);
    expect(screen.getByLabelText("Show retired stamps")).toBeTruthy();
  });

  it("AC-9: expand all and collapse all are always there", () => {
    setup(false);
    expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeTruthy();
  });
});
