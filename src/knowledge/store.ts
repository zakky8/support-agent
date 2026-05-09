// ─────────────────────────────────────────────────────────
// Knowledge Store — Production Vector Search
// Uses Pinecone Vector Database and Google/OpenAI embeddings.
// ─────────────────────────────────────────────────────────

import { KnowledgeChunk } from '../agent/types';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs';
import path from 'path';

class KnowledgeStore {
  private vectorStore: PineconeStore | null = null;
  private isLoaded = false;
  private pinecone: Pinecone;

  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || 'fake-api-key',
    });
  }

  private getEmbeddings() {
    if (config.llm.provider === 'openai') {
      return new OpenAIEmbeddings({
        openAIApiKey: config.llm.openai.apiKey,
        modelName: 'text-embedding-3-small',
      });
    }
    return new GoogleGenerativeAIEmbeddings({
      apiKey: config.llm.google.apiKey,
      model: 'text-embedding-004',
    });
  }

  async loadDocuments(): Promise<void> {
    const dir = config.rag.knowledgeDir;
    
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY === 'fake-api-key') {
      logger.warn('PINECONE_API_KEY is not set. Falling back to simple mode or skipping RAG ingestion in production. Set PINECONE_API_KEY to enable full vector search.');
      this.isLoaded = true;
      return;
    }

    if (!fs.existsSync(dir)) {
      logger.warn(`Knowledge directory not found: ${dir}. Creating it.`);
      fs.mkdirSync(dir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(dir).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.txt', '.md', '.json'].includes(ext);
    });

    if (files.length === 0) {
      logger.warn('No knowledge files found. Agent will rely on base LLM knowledge only.');
      return;
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.rag.chunkSize,
      chunkOverlap: config.rag.chunkOverlap,
    });

    const indexName = process.env.PINECONE_INDEX || 'support-agent-index';
    const pineconeIndex = this.pinecone.Index(indexName);
    
    const embeddings = this.getEmbeddings();

    let allDocs: any[] = [];
    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const docs = await splitter.createDocuments([content], [{ source: file }]);
      allDocs = allDocs.concat(docs);
    }

    logger.info(`Ingesting ${allDocs.length} chunks into Pinecone index: ${indexName}...`);
    this.vectorStore = await PineconeStore.fromDocuments(allDocs, embeddings, {
      pineconeIndex,
    });

    this.isLoaded = true;
    logger.info(`Knowledge base loaded in Pinecone: ${files.length} files.`);
  }

  async search(query: string, topK: number = 5): Promise<KnowledgeChunk[]> {
    if (!this.vectorStore) {
      // If Pinecone is not configured, we gracefully return empty arrays to fall back to base LLM.
      return [];
    }

    const results = await this.vectorStore.similaritySearchWithScore(query, topK);
    
    return results.map(([doc, score]: [any, number]) => ({
      content: doc.pageContent,
      source: doc.metadata.source as string,
      score,
    }));
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  get chunkCount(): number {
    return 0; // Pinecone doesn't expose a cheap synchronous count
  }
}

export const knowledgeBase = new KnowledgeStore();
