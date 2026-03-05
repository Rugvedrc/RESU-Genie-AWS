"""
Resume Parser Service - Supports PDF and DOCX
Extracts structured data using file parsing + OpenAI GPT
"""
import os
import json
import fitz  # PyMuPDF
from docx import Document
from openai import OpenAI


client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o')


def extract_text_from_pdf(filepath: str) -> str:
    """Extract raw text from PDF using PyMuPDF."""
    doc = fitz.open(filepath)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def extract_text_from_docx(filepath: str) -> str:
    """Extract raw text from DOCX file."""
    doc = Document(filepath)
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n".join(paragraphs)


PARSE_PROMPT = """
You are an expert resume analyzer. Extract ALL information from the following resume text into a structured JSON format.

Return EXACTLY this JSON structure (all fields required):
{
  "personal_info": {
    "name": "", "email": "", "phone": "", "location": "",
    "linkedin": "", "github": "", "portfolio": ""
  },
  "summary": "",
  "experience": [
    {
      "company": "", "role": "", "duration": "", "years": 0.0,
      "location": "", "highlights": []
    }
  ],
  "education": [
    {
      "institution": "", "degree": "", "graduation": "", "gpa": "",
      "honors": "", "specialization": ""
    }
  ],
  "skills": {
    "programming": [], "frameworks": [], "cloud": [],
    "databases": [], "ml": [], "tools": []
  },
  "certifications": [{"name": "", "year": ""}],
  "projects": [{"name": "", "description": "", "tech": [], "link": ""}],
  "achievements": []
}

Also provide:
{
  "scores": {
    "overall": 0-100,
    "ats_compatibility": 0-100,
    "experience_relevance": 0-100,
    "skills_match": 0-100,
    "education": 0-100,
    "presentation": 0-100,
    "impact_metrics": 0-100,
    "keywords": 0-100,
    "readability": 0-100,
    "completeness": 0-100
  },
  "strengths": [],
  "improvements": [],
  "keyword_analysis": {
    "found": [],
    "missing": []
  },
  "career_level": "",
  "recommended_roles": []
}

Resume text:
"""


def parse_resume(filepath: str, extension: str) -> dict:
    """Parse resume file and return structured data using GPT-4."""
    # Extract raw text
    if extension == 'pdf':
        raw_text = extract_text_from_pdf(filepath)
    elif extension in ('docx', 'doc'):
        raw_text = extract_text_from_docx(filepath)
    else:
        raise ValueError(f"Unsupported file type: {extension}")

    if not raw_text.strip():
        raise ValueError("Could not extract text from the resume file")

    # Use GPT to structure the data
    response = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": "You are an expert resume parser. Always return valid JSON matching the requested structure exactly."
            },
            {
                "role": "user",
                "content": PARSE_PROMPT + raw_text[:8000]  # Limit to 8k chars
            }
        ],
        temperature=0.1,
        max_tokens=4000
    )

    parsed = json.loads(response.choices[0].message.content)
    parsed['raw_text'] = raw_text  # Keep raw text for embeddings

    return parsed
