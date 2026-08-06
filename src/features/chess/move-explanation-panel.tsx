"use client";

import type { MoveExplanation } from "./move-explanation";
import { explanationToSentences } from "./move-explanation-text";

export function MoveExplanationPanel(props: {
  readonly explanation: MoveExplanation | null;
}): React.ReactElement {
  const { explanation } = props;

  const sentences =
    explanation !== null ? explanationToSentences(explanation) : [];

  return (
    <section
      aria-label="Move explanation"
      className={
        explanation === null
          ? "p-4 rounded-lg bg-neutral-900 text-neutral-100"
          : "p-4 rounded-lg bg-neutral-900 text-neutral-100 space-y-3"
      }
    >
      {explanation === null ? (
        <p className="text-sm text-neutral-400">
          Select a move to see its explanation.
        </p>
      ) : (
        <>
          <h3 className="text-lg font-semibold text-neutral-100">
            {explanation.san}
          </h3>
          <ul className="space-y-1.5 list-disc list-inside text-sm text-neutral-300">
            {sentences.map((sentence, index) => (
              <li key={index}>{sentence}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
