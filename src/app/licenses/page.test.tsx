import { render, screen } from "@testing-library/react";
import LicensesPage from "@/app/licenses/page";

describe("LicensesPage", () => {
  it("renders a heading naming Stockfish", () => {
    render(<LicensesPage />);
    expect(
      screen.getByRole("heading", { name: /Stockfish/i })
    ).toBeInTheDocument();
  });

  it("states the engine is unmodified", () => {
    render(<LicensesPage />);
    expect(screen.getByText(/unmodified/i)).toBeInTheDocument();
  });

  it("has a link to the COPYING.txt file", () => {
    render(<LicensesPage />);
    const link = screen.getByRole("link", { name: /GPLv3 license text|COPYING/i });
    expect(link).toHaveAttribute(
      "href",
      "/licenses/stockfish/18.0.0/COPYING.txt"
    );
  });

  it("has a link to the SOURCE.txt file", () => {
    render(<LicensesPage />);
    const link = screen.getByRole("link", { name: /source provenance|SOURCE/i });
    expect(link).toHaveAttribute(
      "href",
      "/licenses/stockfish/18.0.0/SOURCE.txt"
    );
  });

  it("has a link to stockfish.js GitHub repository", () => {
    render(<LicensesPage />);
    const link = screen.getByRole("link", {
      name: /stockfish\.js repository|stockfish\.js/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/nmrugg/stockfish.js"
    );
  });

  it("has a link to official Stockfish GitHub repository", () => {
    render(<LicensesPage />);
    const link = screen.getByRole("link", {
      name: /official Stockfish repository|official Stockfish/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/official-stockfish/Stockfish"
    );
  });

  it("names the version stockfish@18.0.0 and upstream tag sf_18", () => {
    render(<LicensesPage />);
    expect(screen.getByText(/stockfish@18\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText(/sf_18/)).toBeInTheDocument();
  });

  it("states that GPLv3 applies to the engine and MIT applies to this project's own code", () => {
    render(<LicensesPage />);
    expect(screen.getByText(/section 6\(d\)/)).toBeInTheDocument();
    expect(screen.getByText(/licensed under MIT/)).toBeInTheDocument();
  });

  it("renders no link whose href contains angle brackets", () => {
    render(<LicensesPage />);
    const links = screen.getAllByRole("link");
    const broken = links.filter((link) => {
      const href = link.getAttribute("href") ?? "";
      return href.includes("<") || href.includes(">");
    });
    expect(broken).toHaveLength(0);
  });
});
