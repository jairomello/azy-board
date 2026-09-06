import { AZY_KNOWLEDGE_PACK, KNOWLEDGE_PACK_VERSION, KNOWLEDGE_PACK_SOURCES } from '../apps/api/src/services/assistantKnowledge'

console.log(JSON.stringify({ version: KNOWLEDGE_PACK_VERSION, sources: KNOWLEDGE_PACK_SOURCES, chunks: AZY_KNOWLEDGE_PACK }, null, 2))
