"""
AWS Infrastructure Provisioner
Run ONCE before first deployment to create all required resources.

Usage:
  python aws/provision.py

What it creates:
  S3 bucket (versioned, encrypted, private)
  DynamoDB table (PAY_PER_REQUEST, 90-day TTL)
  SQS queue + DLQ (with redrive policy)
  OpenSearch Serverless collection + index (vector search)
  Logs all ARNs for use in task definitions
"""

import os
import json
import time
import boto3
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

REGION        = os.getenv('AWS_REGION', 'us-east-1')
S3_BUCKET     = os.getenv('S3_BUCKET_NAME', 'resu-genie-resumes')
DYNAMO_TABLE  = os.getenv('DYNAMODB_TABLE_NAME', 'resu-genie-metadata')
SQS_NAME      = os.getenv('SQS_QUEUE_NAME', 'resu-genie-jobs')
DLQ_NAME      = os.getenv('SQS_DLQ_NAME', 'resu-genie-jobs-dlq')
OS_COLLECTION = 'resu-genie-vectors'

sess = boto3.session.Session(region_name=REGION)
account_id = sess.client('sts').get_caller_identity()['Account']


def provision_s3():
    s3 = sess.client('s3')
    print("\n[S3] Creating bucket...")
    try:
        if REGION == 'us-east-1':
            s3.create_bucket(Bucket=S3_BUCKET)
        else:
            s3.create_bucket(Bucket=S3_BUCKET, CreateBucketConfiguration={'LocationConstraint': REGION})
    except s3.exceptions.BucketAlreadyOwnedByYou:
        print(f"  Already exists: {S3_BUCKET}")

    # Encryption
    s3.put_bucket_encryption(Bucket=S3_BUCKET, ServerSideEncryptionConfiguration={
        'Rules': [{'ApplyServerSideEncryptionByDefault': {'SSEAlgorithm': 'AES256'}}]
    })
    # Versioning
    s3.put_bucket_versioning(Bucket=S3_BUCKET, VersioningConfiguration={'Status': 'Enabled'})
    # Block ALL public access
    s3.put_public_access_block(Bucket=S3_BUCKET, PublicAccessBlockConfiguration={
        'BlockPublicAcls': True, 'IgnorePublicAcls': True,
        'BlockPublicPolicy': True, 'RestrictPublicBuckets': True
    })
    # Lifecycle rule: delete raw/ files after 30 days (they're processed)
    s3.put_bucket_lifecycle_configuration(Bucket=S3_BUCKET, LifecycleConfiguration={
        'Rules': [{
            'ID': 'expire-raw-uploads', 'Status': 'Enabled',
            'Filter': {'Prefix': 'raw/'},
            'Expiration': {'Days': 30}
        }]
    })
    print(f"  ✅ s3://{S3_BUCKET}")


def provision_dynamodb():
    dynamo = sess.resource('dynamodb')
    print("\n[DynamoDB] Creating table...")
    try:
        table = dynamo.create_table(
            TableName=DYNAMO_TABLE,
            KeySchema=[{'AttributeName': 'resume_id', 'KeyType': 'HASH'}],
            AttributeDefinitions=[{'AttributeName': 'resume_id', 'AttributeType': 'S'}],
            BillingMode='PAY_PER_REQUEST',
        )
        table.wait_until_exists()
        # Enable TTL
        sess.client('dynamodb').update_time_to_live(
            TableName=DYNAMO_TABLE,
            TimeToLiveSpecification={'Enabled': True, 'AttributeName': 'ttl'}
        )
        print(f"  ✅ Table: {DYNAMO_TABLE}")
    except dynamo.meta.client.exceptions.ResourceInUseException:
        print(f"  Already exists: {DYNAMO_TABLE}")


def provision_sqs():
    sqs = sess.client('sqs')
    print("\n[SQS] Creating DLQ + main queue...")

    # DLQ
    dlq = sqs.create_queue(QueueName=DLQ_NAME, Attributes={
        'MessageRetentionPeriod': str(14 * 24 * 3600)
    })
    dlq_arn = sqs.get_queue_attributes(QueueUrl=dlq['QueueUrl'], AttributeNames=['QueueArn'])['Attributes']['QueueArn']

    # Main queue with redrive → DLQ after 3 failures
    main = sqs.create_queue(QueueName=SQS_NAME, Attributes={
        'VisibilityTimeout': '300',
        'MessageRetentionPeriod': str(4 * 24 * 3600),
        'RedrivePolicy': json.dumps({'deadLetterTargetArn': dlq_arn, 'maxReceiveCount': '3'})
    })
    queue_url = main['QueueUrl']
    print(f"  ✅ Queue: {queue_url}")
    print(f"  ✅ DLQ:   {dlq['QueueUrl']}")
    print(f"\n  ⭐ Add this to .env:\n  SQS_QUEUE_URL={queue_url}")
    return queue_url


def provision_opensearch():
    """
    Creates an OpenSearch Serverless collection for vector search.
    Note: AOSS requires access policies before you can use the collection.
    This creates the minimum required policies.
    """
    aoss = sess.client('opensearchserverless')
    print("\n[OpenSearch Serverless] Creating collection...")

    # Encryption policy (required)
    try:
        aoss.create_security_policy(
            name=f'{OS_COLLECTION}-enc',
            type='encryption',
            policy=json.dumps({
                'Rules': [{'ResourceType': 'collection', 'Resource': [f'collection/{OS_COLLECTION}']}],
                'AWSOwnedKey': True
            })
        )
    except aoss.exceptions.ConflictException:
        pass

    # Network policy — public (change to VPC for production)
    try:
        aoss.create_security_policy(
            name=f'{OS_COLLECTION}-net',
            type='network',
            policy=json.dumps([{
                'Rules': [
                    {'ResourceType': 'collection', 'Resource': [f'collection/{OS_COLLECTION}']},
                    {'ResourceType': 'dashboard', 'Resource': [f'collection/{OS_COLLECTION}']}
                ],
                'AllowFromPublic': True
            }])
        )
    except aoss.exceptions.ConflictException:
        pass

    # Data access policy — allow API + Worker task roles
    data_policy = [{
        'Rules': [
            {
                'ResourceType': 'index',
                'Resource': [f'index/{OS_COLLECTION}/*'],
                'Permission': [
                    'aoss:CreateIndex', 'aoss:ReadDocument', 'aoss:UpdateIndex',
                    'aoss:DescribeIndex', 'aoss:WriteDocument', 'aoss:DeleteDocument'
                ]
            },
            {
                'ResourceType': 'collection',
                'Resource': [f'collection/{OS_COLLECTION}'],
                'Permission': ['aoss:CreateCollectionItems', 'aoss:DescribeCollectionItems', 'aoss:UpdateCollectionItems']
            }
        ],
        'Principal': [
            f'arn:aws:iam::{account_id}:role/resu-genie-api-task-role',
            f'arn:aws:iam::{account_id}:role/resu-genie-worker-task-role'
        ]
    }]
    try:
        aoss.create_access_policy(
            name=f'{OS_COLLECTION}-access',
            type='data',
            policy=json.dumps(data_policy)
        )
    except aoss.exceptions.ConflictException:
        pass

    # Create collection
    try:
        resp = aoss.create_collection(name=OS_COLLECTION, type='VECTORSEARCH')
        collection_id = resp['createCollectionDetail']['id']
        print(f"  Collection created (id: {collection_id}), waiting for ACTIVE state...")
        # Wait up to 10 minutes for collection to become active
        for _ in range(60):
            time.sleep(10)
            detail = aoss.batch_get_collection(names=[OS_COLLECTION])['collectionDetails']
            if detail and detail[0]['status'] == 'ACTIVE':
                endpoint = detail[0]['collectionEndpoint']
                print(f"  ✅ OpenSearch Collection: {endpoint}")
                print(f"\n  ⭐ Add this to .env:\n  OPENSEARCH_ENDPOINT={endpoint}")
                return endpoint
        print("  ⚠️  Collection still creating — check AWS Console and set OPENSEARCH_ENDPOINT manually.")
    except aoss.exceptions.ConflictException:
        # Collection exists — get its endpoint
        detail = aoss.batch_get_collection(names=[OS_COLLECTION])['collectionDetails']
        if detail:
            endpoint = detail[0].get('collectionEndpoint', '')
            print(f"  Already exists: {endpoint}")
            return endpoint


if __name__ == '__main__':
    print("=" * 55)
    print("  RESU-GENIE AWS Infrastructure Provisioner")
    print(f"  Account: {account_id} | Region: {REGION}")
    print("=" * 55)
    provision_s3()
    provision_dynamodb()
    queue_url = provision_sqs()
    os_endpoint = provision_opensearch()
    print("\n" + "=" * 55)
    print("  ✅ All AWS resources provisioned!")
    print("=" * 55)
    print(f"\n📋 Copy these into your .env:")
    print(f"  SQS_QUEUE_URL={queue_url or 'see above'}")
    print(f"  OPENSEARCH_ENDPOINT={os_endpoint or 'see above'}")
