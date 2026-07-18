import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the Learn Review Chess product name", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Learn Review Chess", level: 1 })
    ).toBeInTheDocument();
  });

  it("renders the product description", () => {
    render(<Home />);
    expect(
      screen.getByText(
        "Review your games, understand your mistakes, and improve your chess."
      )
    ).toBeInTheDocument();
  });

  it("renders Review, Learn, and Analysis navigation items", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analysis" })).toBeInTheDocument();
  });

  it("marks Review as the selected section", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("renders the interactive chessboard placeholder", () => {
    render(<Home />);
    expect(
      screen.getByRole("region", { name: "Interactive chessboard" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Interactive chessboard")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The interactive board will be added in the next development stage."
      )
    ).toBeInTheDocument();
  });

  it("renders the Game review panel empty state", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Game review" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Import a completed game to begin reviewing.")
    ).toBeInTheDocument();
  });
});
