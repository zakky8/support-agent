import { config } from './src/config';
import { knowledgeBase } from './src/knowledge/store';
import { logger } from './src/utils/logger';

async function testRAG() {
  logger.info('Starting RAG Debugging...');

  // Mock config values
  config.rag.chunkSize = 500;
  config.rag.chunkOverlap = 100;
  config.rag.topK = 3;

  try {
    logger.info('1. Ingesting knowledge base...');
    await knowledgeBase.loadDocuments();
    logger.info('Ingestion complete. Total chunks: ' + knowledgeBase.chunkCount);

    const testQueries = [
      'Can I trade news?',
      'What is the rule for IP addresses?',
      'Do I need a stop loss?',
      'Can I use HFT EAs?'
    ];

    for (const q of testQueries) {
      logger.info(`\n\n--- Query: "${q}" ---`);
      const results = await knowledgeBase.search(q, 2);
      if (results.length === 0) {
        logger.warn('No results found.');
      } else {
        results.forEach((r, i) => {
          logger.info(`Result ${i + 1} (Score: ${r.score.toFixed(2)}): \n${r.content.substring(0, 150)}...`);
        });
      }
    }
    
    logger.info('\n\nRAG Debugging Complete! No errors.');
  } catch (err) {
    logger.error('RAG Error', { error: err });
  }
}

testRAG();
