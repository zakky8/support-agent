// ─────────────────────────────────────────────────────────
// Knowledge Store — In-Memory Vector Search
// A lightweight vector store using cosine similarity.
// For production, swap this with Pinecone, Chroma, or Weaviate.
// ─────────────────────────────────────────────────────────

import { KnowledgeChunk } from '../agent/types';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs';
import path from 'path';

interface EmbeddedChunk {
  content: string;
  source: string;
  embedding: number[];
}

class KnowledgeStore {
  private chunks: EmbeddedChunk[] = [];
  private isLoaded = false;

  /** Cosine similarity between two vectors */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Generate embeddings using a simple hash-based approach.
   * In production, replace with proper embedding model calls.
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Simple but effective TF-IDF-like embedding for local use.
    // For production, use Google's text-embedding or OpenAI's ada-002.
    const dimension = 384;
    const embedding = new Array(dimension).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        const char = word.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
      }
      // Distribute across multiple dimensions
      for (let d = 0; d < 8; d++) {
        const idx = Math.abs((hash * (d + 1)) % dimension);
        embedding[idx] += 1.0 / words.length;
      }
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Load and embed all documents from the knowledge directory.
   */
  async loadDocuments(): Promise<void> {
    const dir = config.rag.knowledgeDir;

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

    let totalChunks = 0;

    for (const file of files) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const docs = await splitter.createDocuments([content], [{ source: file }]);

      for (const doc of docs) {
        const embedding = await this.generateEmbedding(doc.pageContent);
        this.chunks.push({
          content: doc.pageContent,
          source: file,
          embedding,
        });
        totalChunks++;
      }
    }

    this.isLoaded = true;
    logger.info(`Knowledge base loaded: ${files.length} files, ${totalChunks} chunks`);
  }

  /**
   * Semantic search — find the most relevant chunks for a query.
   */
  async search(query: string, topK: number = 5): Promise<KnowledgeChunk[]> {
    if (this.chunks.length === 0) {
      return [];
    }

    const queryEmbedding = await this.generateEmbedding(query);

    const scored = this.chunks.map((chunk) => ({
      content: chunk.content,
      source: chunk.source,
      score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, topK).filter((c) => c.score > 0.1);
  }

  /** Check if the knowledge base has been loaded */
  get loaded(): boolean {
    return this.isLoaded;
  }

  /** Get the total number of chunks */
  get chunkCount(): number {
    return this.chunks.length;
  }
}

// Singleton
export const knowledgeBase = new KnowledgeStore();
