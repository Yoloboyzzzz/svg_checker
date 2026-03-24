import type { CheckRule } from '../../types'
import { groupRule } from './groupRule'
import { compoundPathRule } from './compoundPathRule'
import { duplicatePathRule } from './duplicatePathRule'

export const DEFAULT_RULES: CheckRule[] = [groupRule, compoundPathRule, duplicatePathRule]

export const DEFAULT_WEIGHTS = {
  'groups': 1/3,
  'compound-paths': 1/3,
  'duplicate-paths': 1/3,
} as const
