import type { CheckRule } from '../../types'
import { groupRule } from './groupRule'
import { compoundPathRule } from './compoundPathRule'
import { duplicatePathRule } from './duplicatePathRule'
import { disconnectedLineRule } from './disconnectedLineRule'

export const DEFAULT_RULES: CheckRule[] = [groupRule, compoundPathRule, duplicatePathRule, disconnectedLineRule]

export const DEFAULT_WEIGHTS = {
  'groups': 1/4,
  'compound-paths': 1/4,
  'duplicate-paths': 1/4,
  'disconnected-lines': 1/4,
} as const
