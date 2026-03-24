/**
 * Contract: CheckRule
 *
 * Every SVG check rule MUST implement this interface.
 * Rules are self-contained: adding or removing a rule requires changes only
 * to the rule's own file and the rules registry array (src/checker/rules/index.ts).
 *
 * Constitution Principle V: Modularity
 */

import type { CheckCategory, CheckResult } from '../../../src/types/index';

export interface CheckRule {
  /** Unique identifier for this check category */
  readonly category: CheckCategory;

  /** Human-readable label displayed in the UI */
  readonly label: string;

  /**
   * Default weight in the quality score (0–1).
   * All default weights across registered rules MUST sum to 1.
   */
  readonly defaultWeight: number;

  /**
   * Analyse the parsed SVG document.
   * MUST be a pure read operation — MUST NOT mutate `doc`.
   *
   * @param doc - A Document parsed from SVG markup via DOMParser
   * @returns CheckResult with pass/fail, violation count, and violation details
   */
  check(doc: Document): CheckResult;

  /**
   * Apply the fix for this category to the document in-place.
   * Called only when the user clicks "Fix Issues".
   * MUST produce a document that, when re-checked, passes this rule (check returns pass=true).
   *
   * @param doc - A Document parsed from SVG markup via DOMParser (will be mutated)
   */
  fix(doc: Document): void;
}
