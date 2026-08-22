-- LawReference corpus fields + embedding chunks for hybrid RAG
ALTER TABLE "LawReference" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'National';
ALTER TABLE "LawReference" ADD COLUMN IF NOT EXISTS "corpusStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "LawReference" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

CREATE TABLE IF NOT EXISTS "LawEmbeddingChunk" (
    "id" TEXT NOT NULL,
    "lawReferenceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "chunkText" TEXT NOT NULL,
    "embeddingJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawEmbeddingChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LawEmbeddingChunk_lawReferenceId_idx" ON "LawEmbeddingChunk"("lawReferenceId");

ALTER TABLE "LawEmbeddingChunk" DROP CONSTRAINT IF EXISTS "LawEmbeddingChunk_lawReferenceId_fkey";
ALTER TABLE "LawEmbeddingChunk" ADD CONSTRAINT "LawEmbeddingChunk_lawReferenceId_fkey"
    FOREIGN KEY ("lawReferenceId") REFERENCES "LawReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
