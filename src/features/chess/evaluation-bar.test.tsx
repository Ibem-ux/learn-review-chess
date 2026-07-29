import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { EVAL_CLAMP_CP } from "@/features/chess/evaluation-graph-model";
import { EvaluationBar } from "@/features/chess/evaluation-bar";
import type { GraphPoint } from "@/features/chess/evaluation-graph-model";

const POINT_WHITE_ADVANTAGE: GraphPoint = {
  ply: 0,
  hasValue: true,
  clampedCp: 150,
  advantage: 0.575,
  isMate: false,
  san: null,
};

const POINT_BLACK_ADVANTAGE: GraphPoint = {
  ply: 0,
  hasValue: true,
  clampedCp: -150,
  advantage: 0.425,
  isMate: false,
  san: null,
};

const POINT_EQUAL: GraphPoint = {
  ply: 0,
  hasValue: true,
  clampedCp: 0,
  advantage: 0.5,
  isMate: false,
  san: null,
};

const POINT_MATE_WHITE: GraphPoint = {
  ply: 0,
  hasValue: true,
  clampedCp: 1000,
  advantage: 1,
  isMate: true,
  san: null,
};

const POINT_MATE_BLACK: GraphPoint = {
  ply: 0,
  hasValue: true,
  clampedCp: -1000,
  advantage: 0,
  isMate: true,
  san: null,
};

describe("EvaluationBar", () => {
  it("null point renders the unavailable label", () => {
    const { getByTestId } = render(<EvaluationBar point={null} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation unavailable");
  });

  it("hasValue false renders the unavailable label", () => {
    const point: GraphPoint = {
      ply: 0,
      hasValue: false,
      clampedCp: null,
      advantage: null,
      isMate: false,
      san: null,
    };
    const { getByTestId } = render(<EvaluationBar point={point} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation unavailable");
  });

  it("equality renders 'Evaluation: equal'", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_EQUAL} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: equal");
  });

  it("White advantage wording and one-decimal pawn value", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_WHITE_ADVANTAGE} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: White ahead by 1.5 pawns");
  });

  it("Black advantage wording and one-decimal pawn value", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_BLACK_ADVANTAGE} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: Black ahead by 1.5 pawns");
  });

  it("mate for White wording", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_MATE_WHITE} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: forced mate for White");
  });

  it("mate for Black wording", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_MATE_BLACK} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: forced mate for Black");
  });

  it("mate label is chosen by sign using EVAL_CLAMP_CP", () => {
    const whiteMate: GraphPoint = {
      ply: 0,
      hasValue: true,
      clampedCp: EVAL_CLAMP_CP,
      advantage: 1,
      isMate: true,
      san: null,
    };
    const blackMate: GraphPoint = {
      ply: 0,
      hasValue: true,
      clampedCp: -EVAL_CLAMP_CP,
      advantage: 0,
      isMate: true,
      san: null,
    };

    const whiteResult = render(<EvaluationBar point={whiteMate} orientation="white" />);
    expect(within(whiteResult.container).getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: forced mate for White");

    const blackResult = render(<EvaluationBar point={blackMate} orientation="white" />);
    expect(within(blackResult.container).getByTestId("evaluation-bar").getAttribute("aria-label")).toBe("Evaluation: forced mate for Black");
  });

  it("orientation white versus black produces different fill geometry", () => {
    const { container: whiteContainer } = render(<EvaluationBar point={POINT_WHITE_ADVANTAGE} orientation="white" />);
    const { container: blackContainer } = render(<EvaluationBar point={POINT_WHITE_ADVANTAGE} orientation="black" />);

    const whiteFill = whiteContainer.querySelector('[data-testid="evaluation-bar-fill"]');
    const blackFill = blackContainer.querySelector('[data-testid="evaluation-bar-fill"]');

    expect(whiteFill?.getAttribute("style")).toBe("height: 57.5%; bottom: 0px;");
    expect(blackFill?.getAttribute("style")).toBe("height: 57.5%; top: 0px;");
  });

  it("advantage 1 and advantage 0 produce the extreme fills", () => {
    const { container: whiteContainer } = render(<EvaluationBar point={POINT_MATE_WHITE} orientation="white" />);
    const { container: blackContainer } = render(<EvaluationBar point={POINT_MATE_BLACK} orientation="white" />);

    const whiteFill = whiteContainer.querySelector('[data-testid="evaluation-bar-fill"]');
    const blackFill = blackContainer.querySelector('[data-testid="evaluation-bar-fill"]');

    expect(whiteFill?.getAttribute("style")).toBe("height: 100%; bottom: 0px;");
    expect(blackFill?.getAttribute("style")).toBe("height: 0%; bottom: 0px;");
  });

  it("the root has role='img'", () => {
    const { getByTestId } = render(<EvaluationBar point={POINT_EQUAL} orientation="white" />);
    expect(getByTestId("evaluation-bar").getAttribute("role")).toBe("img");
  });
});
