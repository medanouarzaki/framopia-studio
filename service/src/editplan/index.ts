export * from './types.js';
export {
  assertValidEditPlan,
  validateEditPlan,
  EditPlanValidationError,
  EditPlanVersionError,
  type PlanValidationIssue,
} from './validate.js';
export { createEditPlan, editPlanPathFor, readEditPlan, writeEditPlan } from './io.js';
export {
  humanFlaggedItems,
  mergeIntoExistingPlan,
  PlanMergeBlockedError,
  transcriptContentHash,
  TRANSCRIPT_DEPENDENT_BLOCKS,
  type HumanFlag,
  type MergePlanResult,
} from './merge.js';
