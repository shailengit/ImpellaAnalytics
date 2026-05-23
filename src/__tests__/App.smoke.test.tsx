import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "../App";

afterEach(cleanup);

describe("App smoke test", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it("renders the header title", () => {
    render(<App />);
    expect(screen.getByText("Impella")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("renders the footer version text", () => {
    render(<App />);
    expect(screen.getByText("Ver: 4.2.0.BUILD_CLINICAL")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<App />);
    expect(screen.getByText("Hemodynamic Recovery Lead")).toBeInTheDocument();
  });

  it("renders the upload button", () => {
    render(<App />);
    expect(screen.getByText("Upload Clinical RHC")).toBeInTheDocument();
  });
});
