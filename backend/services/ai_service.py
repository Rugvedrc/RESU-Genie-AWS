"""
AI Chat Service - RAG-powered Resume Chat using OpenAI
"""
import os
from openai import OpenAI


client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')


SYSTEM_PROMPT = """You are RESU-GENIE, an expert AI career counselor and resume analyst.
You have deep knowledge of the resume provided and can answer questions about the candidate's:
- Work experience and achievements
- Skills and technical expertise
- Education and certifications
- Projects and contributions
- Career trajectory and recommendations

Use the provided context chunks from the resume to answer questions accurately.
Be specific, cite actual data from the resume, and provide career-focused insights.
If information isn't in the resume context, say so clearly rather than guessing.
Format your responses with markdown for clarity."""


def chat_with_resume(message: str, context_chunks: list, history: list) -> dict:
    """
    Generate a context-aware response using RAG.
    context_chunks: Relevant resume sections retrieved from Pinecone
    history: Previous conversation turns
    """
    # Build context string from retrieved chunks
    context = "\n\n---\n\n".join([
        f"[Resume Section - Relevance: {c['score']}]\n{c['text']}"
        for c in context_chunks
    ])

    # Build message history
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add conversation history (last 10 turns)
    for turn in history[-10:]:
        messages.append({"role": turn['role'], "content": turn['content']})

    # Add current message with context
    user_message = f"""Context from resume:
{context}

Question: {message}"""

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=800
    )

    return {
        "content": response.choices[0].message.content,
        "sources": [
            {"section": c["section"], "relevance": c["score"]}
            for c in context_chunks[:3]
        ],
        "usage": {
            "prompt_tokens": response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens
        }
    }
