/**
 * Contract: SVGAnalyzer
 *
 * The analyzer accepts raw SVG markup and returns a QualityReport.
 * It delegates to each registered CheckRule and aggregates results.
 */

import type { QualityReport } from '../../../src/types/index';

export interface SVGAnalyzer {
  /**
   * Parse and analyse the SVG string.
   *
   * @param svgString - Raw SVG file content as a string
   * @param filename  - Original filename (for the report metadata)
   * @param fileSize  - Original file size in bytes (for the report metadata)
   * @returns QualityReport with weighted score and per-category results
   * @throws Error if svgString contains malformed XML (parsererror detected)
   */
  analyze(svgString: string, filename: string, fileSize: number): QualityReport;
}

export interface SVGFixer {
  /**
   * Apply all registered fix operations to the SVG and return the corrected markup.
   *
   * @param svgString - Raw SVG file content as a string (original, not yet fixed)
   * @param filename  - Original filename (used to generate the fixed filename)
   * @returns FixedSVG with corrected content, suggested filename, and re-analysis report
   * @throws Error if svgString contains malformed XML
   */
  fix(
    svgString: string,
    filename: string,
    fileSize: number
  ): import('../../../src/types/index').FixedSVG;
}
