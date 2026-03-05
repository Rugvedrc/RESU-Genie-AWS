"""
AWS ECS Task Definition Generator
Run: python aws/task_definition.py > aws/task-def.json
"""
import json

TASK_DEF = {
    "family": "resu-genie-task",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/resu-genie-task-role",
    "containerDefinitions": [
        {
            "name": "resu-genie-backend",
            "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/resu-genie:latest",
            "portMappings": [
                {"containerPort": 5000, "protocol": "tcp"}
            ],
            "essential": True,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/resu-genie",
                    "awslogs-region": "us-east-1",
                    "awslogs-stream-prefix": "backend"
                }
            },
            "secrets": [
                {"name": "OPENAI_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:resu-genie/openai-api-key"},
                {"name": "PINECONE_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:resu-genie/pinecone-api-key"}
            ],
            "environment": [
                {"name": "DEMO_MODE", "value": "false"},
                {"name": "AWS_REGION", "value": "us-east-1"},
                {"name": "S3_BUCKET_NAME", "value": "resu-genie-resumes"},
                {"name": "DYNAMODB_TABLE_NAME", "value": "resu-genie-metadata"},
                {"name": "PINECONE_INDEX_NAME", "value": "resu-genie-index"},
                {"name": "APP_ENV", "value": "production"},
                {"name": "APP_PORT", "value": "5000"}
            ],
            "healthCheck": {
                "command": ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')\" || exit 1"],
                "interval": 30,
                "timeout": 10,
                "retries": 3,
                "startPeriod": 30
            }
        }
    ]
}

if __name__ == '__main__':
    print(json.dumps(TASK_DEF, indent=2))
