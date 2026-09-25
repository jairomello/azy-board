/** Shared Azy Agent adapter. It never accepts a credential or actor from tool arguments. */
export {
  friendlyToolName,
  getSharedToolDefinitions,
  dependencyToolsFor,
  searchSharedTools,
  selectSharedTools,
  SKILL_COMMAND_INTENTS,
  SHARED_TOOL_NAMES,
} from '@azy-board/tool-registry'
export type { HumanToolContext, ToolDefinition } from '@azy-board/tool-registry'
export {
  assertHumanContext,
  executeSharedTool,
  sanitizeToolOutput,
} from '../../../mcp/src/registry.js'
export type { ToolExecution } from '../../../mcp/src/registry.js'
