"""
AWS Service Layer — S3 (presigned URLs), SQS, DynamoDB

Key design decisions:
  - Presigned S3 URLs: Frontend uploads DIRECTLY to S3, bypassing API server.
    This saves bandwidth, reduces API load, and is best practice for file uploads.
  - SQS: After S3 upload, a job message is queued. Worker processes async.
  - No AWS keys in production — IAM task role handles credential delivery.

Credential flow in production (ECS):
  boto3 → IMDS (169.254.169.254) → ECS task role → IAM permissions
"""

import os
import json
import uuid
import boto3
from datetime import datetime, timezone

AWS_REGION    = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET     = os.getenv('S3_BUCKET_NAME', 'resu-genie-resumes')
DYNAMO_TABLE  = os.getenv('DYNAMODB_TABLE_NAME', 'resu-genie-metadata')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL', '')


def _session():
    """
    Return a boto3 session.
    In ECS production: credentials come from task role via IMDS automatically.
    Locally: reads from ~/.aws/credentials or AWS_ACCESS_KEY_ID env vars.
    boto3 credential chain (in order):
      1. Env vars (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
      2. ~/.aws/credentials file
      3. AWS IAM role (IMDS on EC2/ECS) ← used in production!
    """
    return boto3.session.Session(region_name=AWS_REGION)


# =====================
# S3 — PRESIGNED URLS
# =====================
def generate_presigned_upload_url(filename: str, content_type: str, resume_id: str) -> dict:
    """
    Generate a presigned S3 POST URL.
    The FRONTEND uses this to upload directly to S3 — bypassing the API.

    🧠 LEARNING: Presigned URLs
    A presigned URL is a time-limited, pre-authenticated URL that allows
    a client to perform a specific S3 operation without having AWS credentials.
    The API server (which HAS credentials) signs the URL using its IAM role.
    The client uses the URL within the expiry window (here: 10 minutes).

    Flow:
      Frontend → POST /api/upload/presign  → API generates presigned URL
      Frontend → PUT <presigned_url> (file bytes) → S3 directly (no API involved!)
      Frontend → POST /api/upload/complete  → API publishes SQS job
    """
    s3 = _session().client('s3')
    ext = filename.rsplit('.', 1)[-1].lower()
    s3_key = f"raw/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{resume_id}.{ext}"

    # generate_presigned_url for PUT (simpler than POST for browser fetch)
    presigned_url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': S3_BUCKET,
            'Key': s3_key,
            'ContentType': content_type,
            'ServerSideEncryption': 'AES256'         # encrypt at rest
        },
        ExpiresIn=600   # 10 minutes
    )
    return {'url': presigned_url, 's3_key': s3_key}


def get_presigned_download_url(s3_key: str, expires_in: int = 3600) -> str:
    """Return a presigned GET URL for securely downloading a resume."""
    s3 = _session().client('s3')
    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET, 'Key': s3_key},
        ExpiresIn=expires_in
    )


# =====================
# SQS — JOB QUEUE
# =====================
def publish_processing_job(resume_id: str, s3_key: str, filename: str, user_metadata: dict = None) -> str:
    """
    Publish a resume processing job to SQS.
    The ECS worker (or Lambda) will pick this up and:
      1. Download the file from S3
      2. Parse with Bedrock
      3. Embed chunks into OpenSearch
      4. Save metadata to DynamoDB
      5. Update job status

    🧠 LEARNING: SQS message visibility timeout
    When a worker picks up a message, it becomes 'invisible' to other workers
    for the visibility timeout period (default: 30s, we set to 5 min).
    If the worker crashes, the message reappears and another worker retries.
    After maxReceiveCount retries, the message goes to the DLQ.
    """
    sqs = _session().client('sqs')
    message_body = {
        'resume_id': resume_id,
        's3_key': s3_key,
        'filename': filename,
        'submitted_at': datetime.now(timezone.utc).isoformat(),
        'user_metadata': user_metadata or {}
    }
    response = sqs.send_message(
        QueueUrl=SQS_QUEUE_URL,
        MessageBody=json.dumps(message_body),
        MessageAttributes={
            'resume_id': {'StringValue': resume_id, 'DataType': 'String'},
            'filename':  {'StringValue': filename,  'DataType': 'String'}
        },
        # Message group ID for FIFO queues (optional, for ordering)
        # MessageGroupId='resume-processing'  # uncomment if using FIFO queue
    )
    msg_id = response['MessageId']
    print(f"[SQS] Published job {msg_id} for resume_id={resume_id}")
    return msg_id


def get_queue_url(queue_name: str) -> str:
    """Look up the SQS queue URL by name (useful at startup)."""
    sqs = _session().client('sqs')
    response = sqs.get_queue_url(QueueName=queue_name)
    return response['QueueUrl']


# =====================
# DYNAMODB — METADATA
# =====================
def save_job_status(resume_id: str, status: str, data: dict = None) -> None:
    """
    Write/update a resume job record in DynamoDB.
    status: 'pending' | 'processing' | 'complete' | 'failed'
    """
    dynamo = _session().resource('dynamodb')
    table = dynamo.Table(DYNAMO_TABLE)
    item = {
        'resume_id': resume_id,
        'status': status,
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'ttl': int(datetime.now(timezone.utc).timestamp()) + (90 * 24 * 3600)
    }
    if data:
        # Flatten selected fields for query efficiency
        pi = data.get('personal_info', {})
        scores = data.get('scores', {})
        item.update({
            'name':            pi.get('name', ''),
            'email':           pi.get('email', ''),
            'career_level':    data.get('career_level', ''),
            'overall_score':   str(scores.get('overall', 0)),
            'scores_json':     json.dumps(scores),
            'full_result_s3':  data.get('result_s3_key', '')   # full JSON stored in S3
        })
    table.put_item(Item=item)
    print(f"[DynamoDB] resume_id={resume_id} → status={status}")


def get_job_status(resume_id: str) -> dict:
    """Fetch the current state of a processing job."""
    dynamo = _session().resource('dynamodb')
    table = dynamo.Table(DYNAMO_TABLE)
    response = table.get_item(Key={'resume_id': resume_id})
    return response.get('Item', {})


def list_all_resumes(limit: int = 50) -> list:
    """Scan DynamoDB for all resume records (use with care on large tables)."""
    dynamo = _session().resource('dynamodb')
    table = dynamo.Table(DYNAMO_TABLE)
    response = table.scan(Limit=limit)
    return response.get('Items', [])


def save_full_result_to_s3(resume_id: str, result: dict) -> str:
    """
    Save the full parsed result JSON to S3 (cheap storage).
    DynamoDB item size is limited to 400KB — full resume data may exceed this.
    So we store just a pointer in DynamoDB and the full result in S3.
    """
    s3 = _session().client('s3')
    key = f"results/{resume_id}/analysis.json"
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=json.dumps(result, default=str),
        ContentType='application/json',
        ServerSideEncryption='AES256'
    )
    return key


def load_full_result_from_s3(s3_key: str) -> dict:
    """Load the full analysis result from S3."""
    s3 = _session().client('s3')
    obj = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
    return json.loads(obj['Body'].read())


# =====================
# INFRA PROVISIONING
# =====================
def provision_sqs_queues() -> dict:
    """
    Create SQS standard queue + DLQ.
    Run once before first deployment. Safe to re-run (idempotent).

    🧠 LEARNING: SQS DLQ (Dead Letter Queue)
    If a message fails processing more than maxReceiveCount times,
    it's moved to the DLQ instead of being deleted.
    DLQs let you inspect failed messages without losing them.
    You can set CloudWatch alarms on DLQ depth for monitoring.
    """
    sqs = _session().client('sqs')
    base_name = os.getenv('SQS_QUEUE_NAME', 'resu-genie-jobs')
    dlq_name  = os.getenv('SQS_DLQ_NAME',   'resu-genie-jobs-dlq')

    # Create DLQ first
    dlq = sqs.create_queue(QueueName=dlq_name, Attributes={
        'MessageRetentionPeriod': str(14 * 24 * 3600)  # 14 days
    })
    dlq_url = dlq['QueueUrl']
    dlq_attrs = sqs.get_queue_attributes(QueueUrl=dlq_url, AttributeNames=['QueueArn'])
    dlq_arn = dlq_attrs['Attributes']['QueueArn']
    print(f"[SQS] DLQ: {dlq_url}")

    # Create main queue with redrive policy (points at DLQ)
    redrive = json.dumps({'deadLetterTargetArn': dlq_arn, 'maxReceiveCount': '3'})
    main_q = sqs.create_queue(QueueName=base_name, Attributes={
        'VisibilityTimeout': '300',   # 5 min — worker has this long to process
        'MessageRetentionPeriod': str(4 * 24 * 3600),   # 4 days
        'RedrivePolicy': redrive
    })
    queue_url = main_q['QueueUrl']
    print(f"[SQS] Main queue: {queue_url}")

    return {'queue_url': queue_url, 'dlq_url': dlq_url}


if __name__ == '__main__':
    result = provision_sqs_queues()
    print(f"\n✅ SQS provisioned!\nSet SQS_QUEUE_URL={result['queue_url']} in your .env")
