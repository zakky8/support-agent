// ─────────────────────────────────────────────────────────
// Knowledge Ingestion Script
// Run with: npm run ingest
// Loads all documents from the knowledge/ directory into
// the vector store and reports statistics.
// ─────────────────────────────────────────────────────────

import { knowledgeBase } from './store';
import { logger } from '../utils/logger';

async function main() {
  logger.info('Starting knowledge base ingestion...');

  const start = Date.now();
  await knowledgeBase.loadDocuments();
  const elapsed = Date.now() - start;

  logger.info(`Ingestion complete in ${elapsed}ms`);
  logger.info(`Total chunks indexed: ${knowledgeBase.chunkCount}`);

  // Run a test query
  const testQuery = 'How do I get support?';
  logger.info(`Running test query: "${testQuery}"`);
  const results = await knowledgeBase.search(testQuery, 3);

  if (results.length > 0) {
    logger.info(`Found ${results.length} results:`);
    results.forEach((r, i) => {
      logger.info(`  [${i + 1}] Score: ${r.score.toFixed(4)} | Source: ${r.source}`);
      logger.info(`      ${r.content.substring(0, 100)}...`);
    });
  } else {
    logger.warn('No results found. Make sure you have documents in the knowledge/ directory.');
  }
}

main().catch((err) => {
  logger.error('Ingestion failed', { error: err });
  process.exit(1);
});
