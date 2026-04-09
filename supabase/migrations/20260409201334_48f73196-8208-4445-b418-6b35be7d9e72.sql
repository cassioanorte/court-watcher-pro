
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- Create match function with search_path including extensions
CREATE OR REPLACE FUNCTION public.match_memories(
  _user_id UUID,
  _tenant_id UUID,
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  summary TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.summary,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity,
    m.created_at
  FROM public.ai_memory m
  WHERE m.user_id = _user_id
    AND m.tenant_id = _tenant_id
    AND (1 - (m.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
