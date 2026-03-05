"""
OpenSearch Serverless — Vector Search Service
Replaces Pinecone. Fully AWS-native, IAM-authenticated.

Architecture:
  - Collection type: SEARCH (vector + full-text)
  - Vector field: 1024 dims (matches Titan Embed v2)
  - Each resume stored in its own namespace via a metadata filter

Why OpenSearch over Pinecone for AWS learning:
  ✅ No external API key — IAM task role handles auth
  ✅ Lives inside your VPC (private, secure)
  ✅ SigV4 request signing (foundational AWS skill)
  ✅ Same approach used by many AWS services (ES/OpenSearch)
"""

import os
import json
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection, AWSV4SignerAuth

AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
OPENSEARCH_ENDPOINT = os.getenv('OPENSEARCH_ENDPOINT', '')
INDEX_NAME = os.getenv('OPENSEARCH_INDEX_NAME', 'resu-genie-vectors')
VECTOR_DIM = 1024  # Titan Embed Text v2 output dimension


def _get_os_client() -> OpenSearch:
    """
    Build an OpenSearch client with AWS SigV4 auth.
    In ECS: credentials come from the task role via IMDS.
    Locally: credentials from ~/.aws/credentials or env vars.
    """
    credentials = boto3.Session().get_credentials()
    auth = AWSV4SignerAuth(credentials, AWS_REGION, 'aoss')  # aoss = OpenSearch Serverless

    return OpenSearch(
        hosts=[{'host': OPENSEARCH_ENDPOINT.replace('https://', ''), 'port': 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        pool_maxsize=20,
        timeout=30
    )


def ensure_index_exists() -> None:
    """
    Create the vector index if it doesn't exist.
    Index mapping: knn_vector field (1024 dims) + metadata fields.

    🧠 LEARNING: OpenSearch k-NN
    OpenSearch uses HNSW (Hierarchical Navigable Small World) graphs
    for approximate nearest neighbour search. This is the same algorithm
    Pinecone uses internally. cosinesimil = cosine similarity metric.
    """
    client = _get_os_client()
    if client.indices.exists(index=INDEX_NAME):
        return

    mapping = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100
            }
        },
        "mappings": {
            "properties": {
                "resume_id": {"type": "keyword"},
                "chunk_index": {"type": "integer"},
                "text": {"type": "text"},
                "embedding": {
                    "type": "knn_vector",
                    "dimension": VECTOR_DIM,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "nmslib",
                        "parameters": {"ef_construction": 128, "m": 24}
                    }
                }
            }
        }
    }
    client.indices.create(index=INDEX_NAME, body=mapping)
    print(f"[OpenSearch] Created index: {INDEX_NAME}")


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split resume text into overlapping chunks."""
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(' '.join(words[i:i + chunk_size]))
        i += chunk_size - overlap
    return chunks


def store_embeddings(resume_id: str, raw_text: str, get_embedding_fn) -> None:
    """
    Chunk resume text, embed each chunk with Titan, and index into OpenSearch.

    🧠 LEARNING: Why chunk at all?
    LLMs have context limits and embeddings work best on shorter passages.
    Chunking with overlap ensures no information is lost at chunk boundaries.
    At query time, we retrieve the most relevant chunks (not the whole resume).
    """
    ensure_index_exists()
    client = _get_os_client()
    chunks = chunk_text(raw_text)

    bulk_body = []
    for i, chunk in enumerate(chunks):
        embedding = get_embedding_fn(chunk)
        doc_id = f"{resume_id}-{i}"
        bulk_body.append({"index": {"_index": INDEX_NAME, "_id": doc_id}})
        bulk_body.append({
            "resume_id": resume_id,
            "chunk_index": i,
            "text": chunk[:2000],
            "embedding": embedding
        })

    if bulk_body:
        client.bulk(body=bulk_body)
        print(f"[OpenSearch] Indexed {len(chunks)} chunks for resume_id={resume_id}")


def query_similar_chunks(resume_id: str, query_embedding: list, top_k: int = 5) -> list:
    """
    k-NN vector search scoped to a specific resume_id.

    🧠 LEARNING: Filtered k-NN Search
    We add a filter on resume_id so we only search chunks from THIS resume.
    This is like Pinecone's namespace filtering — essential for multi-tenant apps.
    """
    client = _get_os_client()
    query = {
        "size": top_k,
        "_source": ["text", "chunk_index", "resume_id"],
        "query": {
            "bool": {
                "must": [
                    {
                        "knn": {
                            "embedding": {
                                "vector": query_embedding,
                                "k": top_k
                            }
                        }
                    }
                ],
                "filter": [
                    {"term": {"resume_id": resume_id}}
                ]
            }
        }
    }
    response = client.search(index=INDEX_NAME, body=query)
    hits = response['hits']['hits']

    return [
        {
            "text": h['_source']['text'],
            "score": h['_score'],
            "section": f"Chunk {h['_source']['chunk_index']}"
        }
        for h in hits
    ]


def delete_resume_embeddings(resume_id: str) -> None:
    """Delete all vectors for a given resume (cleanup on delete)."""
    client = _get_os_client()
    client.delete_by_query(
        index=INDEX_NAME,
        body={"query": {"term": {"resume_id": resume_id}}}
    )
    print(f"[OpenSearch] Deleted embeddings for resume_id={resume_id}")
