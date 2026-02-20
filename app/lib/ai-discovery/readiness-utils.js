/**
 * Shared utilities for AI readiness scoring.
 * This file is safe to import from both client and server code.
 */

/**
 * Get a letter grade from the score.
 */
export function getGrade(score) {
  if (score >= 90) return { grade: "A+", label: "Excellent", tone: "success" };
  if (score >= 80) return { grade: "A", label: "Great", tone: "success" };
  if (score >= 70) return { grade: "B", label: "Good", tone: "info" };
  if (score >= 60) return { grade: "C", label: "Fair", tone: "warning" };
  if (score >= 40) return { grade: "D", label: "Needs Work", tone: "warning" };
  return { grade: "F", label: "Critical", tone: "critical" };
}
