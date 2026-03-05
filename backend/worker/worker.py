"""
RESU-GENIE Worker — SQS Consumer
Runs as a separate ECS Fargate task (or Lambda).

Why a separate worker?
  ✅ Resume parsing via Bedrock can take 5–30 seconds.
  ✅ Blocking the API server for this would waste capacity.
  ✅ SQS decouples ingestion (fast) from processing (slow).
  ✅ If the worker crashes, SQS re-delivers — no data loss.

Worker flow:
  1. Poll SQS for messages (long polling — up to 20s wait)
  2. For each message:
     a. Download file from S3
     b. Extract text (PDF/DOCX)
     c. Parse with Bedrock (Claude 3 Sonnet)
     d. Embed chunks with Titan → store in OpenSearch
     e. Save full result JSON to S3
     f. Update DynamoDB status → 'complete'
     g. Delete message from SQS (ack)
  3. On any error: update DynamoDB → 'failed', let SQS retry (up to maxReceiveCount)

IAM permissions needed for the ECS Worker Task Role:
  - sqs:ReceiveMessage, sqs:DeleteMessage, sqs:GetQueueAttributes
  - s3:GetObject (raw/), s3:PutObject (results/)
  - dynamodb:PutItem, dynamodb:UpdateItem
  - bedrock:InvokeModel
  - es:ESHttpPost, es:ESHttpPut (OpenSearch)
"""

import os
import sys
import json
import time
import tempfile
import boto3
import fitz          # PyMuPDF
from docx import Document
from dotenv import load_dotenv

# Add parent dir to path so we can import services
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

from services.aws_service import (
    save_job_status, save_full_result_to_s3, get_presigned_download_url, _session
)
from services.bedrock_service import parse_resume_with_llm, get_embedding
from services.vector_service import store_embeddings

AWS_REGION    = os.getenv('AWS_REGION', 'us-east-1')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL', '')
S3_BUCKET     = os.getenv('S3_BUCKET_NAME', 'resu-genie-resumes')
DEMO_MODE     = os.getenv('DEMO_MODE', 'true').lower() == 'true'

POLL_WAIT_SECONDS = 20   # SQS long polling (max 20s)
MAX_MESSAGES      = 5    # Process up to 5 messages per poll


# =====================
# TEXT EXTRACTION
# =====================
def extract_text(filepath: str, extension: str) -> str:
    if extension == 'pdf':
        doc = fitz.open(filepath)
        text = '\n'.join(page.get_text() for page in doc)
        doc.close()
    elif extension in ('docx', 'doc'):
        doc = Document(filepath)
        text = '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
    else:
        raise ValueError(f"Unsupported extension: {extension}")
    return text.strip()


# =====================
# PROCESS ONE JOB
# =====================
def process_job(job: dict) -> None:
    resume_id = job['resume_id']
    s3_key    = job['s3_key']
    filename  = job['filename']
    ext       = filename.rsplit('.', 1)[-1].lower()

    print(f"[Worker] Processing resume_id={resume_id} ({filename})")
    save_job_status(resume_id, 'processing')

    # 1. Download file from S3 to temp
    s3 = _session().client('s3')
    with tempfile.NamedTemporaryFile(suffix=f'.{ext}', delete=False) as tmp:
        s3.download_file(S3_BUCKET, s3_key, tmp.name)
        tmp_path = tmp.name

    try:
        # 2. Extract text
        raw_text = extract_text(tmp_path, ext)
        print(f"[Worker] Extracted {len(raw_text)} chars of text")

        # 3. Parse with Bedrock (Claude)
        parsed = parse_resume_with_llm(raw_text)
        print(f"[Worker] Parsed. Overall score: {parsed.get('scores', {}).get('overall', 'N/A')}")

        # 4. Embed + store in OpenSearch
        store_embeddings(resume_id, raw_text, get_embedding)
        print(f"[Worker] Embeddings stored in OpenSearch")

        # 5. Build full result
        result = {
            'resume_id': resume_id,
            'filename': filename,
            's3_key': s3_key,
            'upload_time': job.get('submitted_at', ''),
            **{k: parsed[k] for k in [
                'personal_info', 'summary', 'experience', 'education',
                'skills', 'certifications', 'projects', 'achievements',
                'scores', 'strengths', 'improvements', 'keyword_analysis',
                'career_level', 'recommended_roles'
            ] if k in parsed}
        }

        # 6. Save full JSON to S3 (avoids DynamoDB 400KB limit)
        result_key = save_full_result_to_s3(resume_id, result)
        result['result_s3_key'] = result_key

        # 7. Update DynamoDB status → complete
        save_job_status(resume_id, 'complete', result)
        print(f"[Worker] ✅ Job complete for resume_id={resume_id}")

    except Exception as e:
        print(f"[Worker] ❌ Error processing resume_id={resume_id}: {e}")
        save_job_status(resume_id, 'failed', {'error': str(e)})
        raise   # Re-raise so SQS does NOT delete the message → retry

    finally:
        os.unlink(tmp_path)   # Clean up temp file


# =====================
# MAIN POLL LOOP
# =====================
def run_worker() -> None:
    """
    Long-polling SQS consumer loop.
    Runs indefinitely — designed to be the CMD of an ECS task.
    """
    if not SQS_QUEUE_URL:
        print("[Worker] SQS_QUEUE_URL not set. Exiting.")
        sys.exit(1)

    sqs = _session().client('sqs')
    print(f"[Worker] 🚀 Starting. Polling queue: {SQS_QUEUE_URL}")

    while True:
        try:
            # Long poll — blocks up to POLL_WAIT_SECONDS if queue is empty
            response = sqs.receive_message(
                QueueUrl=SQS_QUEUE_URL,
                MaxNumberOfMessages=MAX_MESSAGES,
                WaitTimeSeconds=POLL_WAIT_SECONDS,
                AttributeNames=['All'],
                MessageAttributeNames=['All'],
                VisibilityTimeout=300    # 5 min — must process within this time
            )
            messages = response.get('Messages', [])
            if not messages:
                print(f"[Worker] Queue empty, polling again...")
                continue

            for msg in messages:
                receipt = msg['ReceiptHandle']
                try:
                    job = json.loads(msg['Body'])
                    process_job(job)
                    # Ack: delete from queue on success
                    sqs.delete_message(QueueUrl=SQS_QUEUE_URL, ReceiptHandle=receipt)
                    print(f"[Worker] Message deleted from queue")
                except Exception as e:
                    # Do NOT delete — let SQS retry up to maxReceiveCount
                    print(f"[Worker] Message left in queue for retry: {e}")

        except KeyboardInterrupt:
            print("[Worker] Shutting down gracefully...")
            break
        except Exception as e:
            print(f"[Worker] Unexpected error: {e}")
            time.sleep(5)


if __name__ == '__main__':
    run_worker()
