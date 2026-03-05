"""
AWS Bedrock Service — LLM + Embeddings
Replaces OpenAI. Uses IAM auth (no API key).

Models used:
  LLM:        anthropic.claude-3-sonnet-20240229-v1:0
  Embeddings: amazon.titan-embed-text-v2:0

In production (ECS), credentials come from the ECS Task Role
via IMDS — boto3 picks them up automatically. No keys in env.
"""

import os
import json
import boto3

AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
LLM_MODEL = os.getenv('BEDROCK_LLM_MODEL', 'anthropic.claude-3-sonnet-20240229-v1:0')
EMBED_MODEL = os.getenv('BEDROCK_EMBEDDING_MODEL', 'amazon.titan-embed-text-v2:0')


def _bedrock_client():
    """Return a Bedrock runtime client.
    Credentials: IAM task role in ECS, ~/.aws/credentials locally.
    """
    return boto3.client('bedrock-runtime', region_name=AWS_REGION)


# ==========================
# EMBEDDINGS
# ==========================
def get_embedding(text: str) -> list[float]:
    """
    Generate a 1024-dim embedding using Amazon Titan Embed Text v2.
    Called by vector_service.py when storing/querying resume chunks.
    """
    client = _bedrock_client()
    body = json.dumps({
        "inputText": text[:8192],      # Titan v2 max input
        "dimensions": 1024,
        "normalize": True
    })
    response = client.invoke_model(
        modelId=EMBED_MODEL,
        contentType='application/json',
        accept='application/json',
        body=body
    )
    result = json.loads(response['body'].read())
    return result['embedding']


# ==========================
# RESUME PARSING
# ==========================
PARSE_PROMPT = """You are an expert resume parser. Extract ALL information from the following resume text and return it as a single JSON object matching EXACTLY this structure:

{
  "personal_info": {
    "name": "", "email": "", "phone": "", "location": "",
    "linkedin": "", "github": "", "portfolio": ""
  },
  "summary": "",
  "experience": [
    { "company": "", "role": "", "duration": "", "years": 0.0, "location": "", "highlights": [] }
  ],
  "education": [
    { "institution": "", "degree": "", "graduation": "", "gpa": "", "honors": "", "specialization": "" }
  ],
  "skills": {
    "programming": [], "frameworks": [], "cloud": [],
    "databases": [], "ml": [], "tools": []
  },
  "certifications": [{ "name": "", "year": "" }],
  "projects": [{ "name": "", "description": "", "tech": [], "link": "" }],
  "achievements": [],
  "scores": {
    "overall": 0, "ats_compatibility": 0, "experience_relevance": 0,
    "skills_match": 0, "education": 0, "presentation": 0,
    "impact_metrics": 0, "keywords": 0, "readability": 0, "completeness": 0
  },
  "strengths": [],
  "improvements": [],
  "keyword_analysis": { "found": [], "missing": [] },
  "career_level": "",
  "recommended_roles": []
}

Score all dimensions from 0–100 based on the resume quality. Return only valid JSON, no explanation."""


def parse_resume_with_llm(raw_text: str) -> dict:
    """
    Send resume text to Claude 3 Sonnet and get structured JSON back.
    """
    client = _bedrock_client()
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "temperature": 0.1,
        "messages": [
            {
                "role": "user",
                "content": f"{PARSE_PROMPT}\n\nResume text:\n{raw_text[:8000]}"
            }
        ]
    })
    response = client.invoke_model(
        modelId=LLM_MODEL,
        contentType='application/json',
        accept='application/json',
        body=body
    )
    result = json.loads(response['body'].read())
    content = result['content'][0]['text']

    # Extract JSON from response (Claude may add minor surrounding text)
    start = content.find('{')
    end = content.rfind('}') + 1
    return json.loads(content[start:end])


# ==========================
# CHAT (RAG)
# ==========================
CHAT_SYSTEM_PROMPT = """You are RESU-GENIE, an expert AI career counselor and resume analyst.
You have access to relevant chunks from the candidate's resume (provided as context).
Answer questions accurately using this context. Be specific, cite concrete details.
If information is not in the context, say so clearly.
Format your response using markdown for clarity."""


def chat_with_context(message: str, context_chunks: list, history: list) -> dict:
    """
    Generate a RAG-based response using Claude 3 Sonnet.
    context_chunks: retrieved from OpenSearch vector search.
    history: previous conversation turns.
    """
    client = _bedrock_client()

    # Build context string
    context = "\n\n---\n\n".join([
        f"[Relevance: {c.get('score', 'N/A')}]\n{c['text']}"
        for c in context_chunks
    ])

    # Build messages list
    messages = []

    # Inject history (last 10 turns)
    for turn in history[-10:]:
        messages.append({"role": turn['role'], "content": turn['content']})

    # Current user message with injected context
    messages.append({
        "role": "user",
        "content": f"Resume Context:\n{context}\n\nQuestion: {message}"
    })

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0.3,
        "system": CHAT_SYSTEM_PROMPT,
        "messages": messages
    })
    response = client.invoke_model(
        modelId=LLM_MODEL,
        contentType='application/json',
        accept='application/json',
        body=body
    )
    result = json.loads(response['body'].read())

    return {
        "content": result['content'][0]['text'],
        "sources": [
            {"section": c.get("section", "Resume"), "relevance": round(c.get("score", 0), 3)}
            for c in context_chunks[:3]
        ],
        "usage": result.get('usage', {})
    }
