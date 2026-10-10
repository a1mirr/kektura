// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import messages from "../../messages/en.json";
import StageControls from "./StageControls";

afterEach(cleanup);

const setup = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StageControls />
    </NextIntlClientProvider>,
  );

describe("spec 0001: the stage controls", () => {
  it("AC-9: expand all and collapse all are always there", () => {
    setup();
    expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse all" })).toBeTruthy();
  });
});
