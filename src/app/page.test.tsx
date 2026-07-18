import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home page", () => {
  it("renders the Learn Review Chess heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "Learn Review Chess" })
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
});
