"""
RESU-GENIE Backend — Flask API (ECS API Service)
AWS-native architecture:
  - Frontend uploads DIRECTLY to S3 via presigned PUT URL
  - API orchestrates: issues presigned URL + publishes SQS job
  - Worker (separate ECS task) does the heavy AI processing
  - Chat and JD-Fit use OpenSearch vector search + Bedrock Claude
"""

import os
import uuid
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')
CORS(app, resources={r"/api/*": {"origins": "*"}})

from services.aws_service import (
    generate_presigned_upload_url, publish_processing_job,
    get_job_status, list_all_resumes, load_full_result_from_s3,
    save_job_status
)
from services.vector_service import query_similar_chunks
from services.bedrock_service import get_embedding, chat_with_context


# ===========================
# API ROUTES
# ===========================

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/api/health')
def health():
    return jsonify({
        "status": "healthy",
        "version": "2.0.0",
        "architecture": {
            "llm": "AWS Bedrock (Claude 3 Sonnet)",
            "embeddings": "AWS Bedrock (Titan Embed v2)",
            "vector_db": "AWS OpenSearch Serverless",
            "queue": "AWS SQS + DLQ",
            "storage": "AWS S3 (presigned PUT upload)",
            "metadata": "AWS DynamoDB"
        }
    })


# ========================
# UPLOAD FLOW (2 steps)
# ========================

@app.route('/api/upload/presign', methods=['POST'])
def presign_upload():
    """
    Step 1: Browser requests a presigned S3 PUT URL.
    Returns {resume_id, upload_url, s3_key}.
    The browser PUTs the file directly to S3 — API never sees the bytes.
    """
    data = request.get_json() or {}
    filename = data.get('filename', 'resume.pdf')
    content_type = data.get('content_type', 'application/pdf')

    ext = filename.rsplit('.', 1)[-1].lower()
    if ext not in ('pdf', 'docx', 'doc'):
        return jsonify({"error": f"Unsupported file type: .{ext}"}), 400

    resume_id = str(uuid.uuid4())
    result = generate_presigned_upload_url(filename, content_type, resume_id)
    return jsonify({
        "resume_id": resume_id,
        "upload_url": result['url'],
        "s3_key": result['s3_key'],
    })


@app.route('/api/upload/complete', methods=['POST'])
def upload_complete():
    """
    Step 2: Frontend calls this after S3 upload succeeds.
    Publishes SQS job and returns immediately — client polls /api/status/:id.
    """
    data = request.get_json() or {}
    resume_id = data.get('resume_id', str(uuid.uuid4()))
    s3_key = data.get('s3_key', '')
    filename = data.get('filename', 'resume.pdf')

    try:
        save_job_status(resume_id, 'pending', {'filename': filename, 's3_key': s3_key})
        msg_id = publish_processing_job(resume_id, s3_key, filename)
        return jsonify({
            "success": True,
            "resume_id": resume_id,
            "message_id": msg_id,
            "status": "pending",
            "async": True,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status/<resume_id>', methods=['GET'])
def job_status(resume_id):
    """Poll for async worker completion."""
    try:
        record = get_job_status(resume_id)
        if not record:
            return jsonify({"status": "not_found"}), 404

        status = record.get('status', 'pending')
        response = {"status": status, "resume_id": resume_id}

        if status == 'complete' and record.get('full_result_s3'):
            response['data'] = load_full_result_from_s3(record['full_result_s3'])
        elif status == 'failed':
            response['error'] = record.get('error', 'Processing failed')

        return jsonify(response)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """RAG chat: Titan embed → OpenSearch k-NN → Bedrock Claude."""
    data = request.get_json() or {}
    message = data.get('message', '')
    resume_id = data.get('resume_id', '')
    history = data.get('history', [])

    if not message:
        return jsonify({"error": "No message provided"}), 400
    if not resume_id:
        return jsonify({"error": "resume_id required"}), 400

    try:
        query_vec = get_embedding(message)
        chunks = query_similar_chunks(resume_id, query_vec, top_k=5)
        result = chat_with_context(message, chunks, history)
        return jsonify({
            "response": result['content'],
            "sources": result['sources'],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/jd-fit', methods=['POST'])
def jd_fit():
    """
    Compare a loaded resume against a pasted job description.
    Returns fit_score, verdict, matched/missing/partial skills,
    dimension_scores, and a personalized recommendation.
    Uses Bedrock Claude to compare JD vs resume context.
    """
    import json as _json
    from services.bedrock_service import _bedrock_client, LLM_MODEL

    data = request.get_json() or {}
    jd_text = data.get('jd_text', '').strip()
    resume_id = data.get('resume_id', '')

    if not jd_text or len(jd_text.split()) < 20:
        return jsonify({"error": "Job description too short (minimum ~20 words)"}), 400
    if not resume_id:
        return jsonify({"error": "resume_id required"}), 400

    try:
        jd_embedding = get_embedding(jd_text[:3000])
        resume_chunks = query_similar_chunks(resume_id, jd_embedding, top_k=8)
        context = "\n\n".join(c['text'] for c in resume_chunks)

        client = _bedrock_client()
        prompt = f"""You are a senior technical recruiter evaluating whether a candidate's resume matches a job description.

Job Description:
{jd_text[:3000]}

Resume Context (extracted sections):
{context[:4000]}

Analyze the match carefully. Return ONLY valid JSON with exactly these keys:
{{
  "fit_score": <integer 0-100>,
  "verdict": "<Strong Fit|Good Fit|Partial Fit|Low Fit>",
  "summary": "<2 sentences summarising why the candidate does or doesn't fit>",
  "personalized_message": "<1-2 sentences direct advice to the candidate, e.g. 'You are well-positioned to apply.' or 'Before applying, tailor your resume to highlight X and Y.'>",
  "matched_skills": ["<skill>"],
  "partial_skills": ["<skill>"],
  "missing_skills": ["<skill>"],
  "dimension_scores": {{
    "technical_skills": <0-100>,
    "experience_level": <0-100>,
    "domain_knowledge": <0-100>,
    "leadership": <0-100>,
    "education": <0-100>
  }},
  "recommendation": "<3-4 sentence hiring recommendation for the recruiter>"
}}"""

        body = _json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "temperature": 0.2,
            "messages": [{"role": "user", "content": prompt}]
        })
        resp = client.invoke_model(
            modelId=LLM_MODEL,
            contentType='application/json',
            accept='application/json',
            body=body
        )
        content = _json.loads(resp['body'].read())['content'][0]['text']
        start = content.find('{')
        end = content.rfind('}') + 1
        result = _json.loads(content[start:end])
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/resumes', methods=['GET'])
def list_resumes():
    """List all analyzed resumes from DynamoDB."""
    try:
        return jsonify({"resumes": list_all_resumes()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ===========================
# ERROR HANDLERS
# ===========================
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Endpoint not found"}), 404
    try:
        return send_from_directory(app.static_folder, 'index.html')
    except Exception:
        return jsonify({"error": "Not found"}), 404


@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File too large (max 10MB)"}), 413


if __name__ == '__main__':
    port = int(os.getenv('APP_PORT', 5000))
    debug = os.getenv('APP_ENV', 'development') == 'development'
    print(f"\n{'='*55}")
    print(f"  RESU-GENIE API v2.0")
    print(f"  LLM:       AWS Bedrock (Claude 3 Sonnet)")
    print(f"  Embeddings: AWS Bedrock (Titan Embed v2)")
    print(f"  VectorDB:  AWS OpenSearch Serverless")
    print(f"  Queue:     AWS SQS + DLQ")
    print(f"{'='*55}\n")
    app.run(host='0.0.0.0', port=port, debug=debug)
