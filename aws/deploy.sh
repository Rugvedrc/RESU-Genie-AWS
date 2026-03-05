#!/bin/bash
# =================================================
# RESU-GENIE — AWS Deployment Script
# Run this step-by-step to deploy to AWS ECS Fargate
# =================================================

set -e  # Exit on any error

# ---- CONFIGURATION (edit these) ----
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_NAME="resu-genie"
ECS_CLUSTER="resu-genie-cluster"
ECS_SERVICE="resu-genie-service"
APP_NAME="resu-genie"

echo "==========================================
  RESU-GENIE AWS DEPLOYMENT
  Account: $AWS_ACCOUNT_ID
  Region: $AWS_REGION
=========================================="

# STEP 1: Create ECR Repository
echo ""
echo "[1/7] Creating ECR Repository..."
aws ecr create-repository \
    --repository-name $ECR_REPO_NAME \
    --region $AWS_REGION \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "  Repository already exists, continuing..."

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
echo "  ECR URI: $ECR_URI"

# STEP 2: Build & Push Docker Image
echo ""
echo "[2/7] Building Docker image..."
docker build -t $ECR_REPO_NAME:latest .
docker tag $ECR_REPO_NAME:latest $ECR_URI:latest

echo "[2b/7] Logging into ECR & Pushing image..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $ECR_URI
docker push $ECR_URI:latest
echo "  ✅ Image pushed to ECR"

# STEP 3: Create ECS Cluster
echo ""
echo "[3/7] Creating ECS Cluster..."
aws ecs create-cluster \
    --cluster-name $ECS_CLUSTER \
    --capacity-providers FARGATE FARGATE_SPOT \
    --region $AWS_REGION \
    2>/dev/null || echo "  Cluster already exists, continuing..."

# STEP 4: Store Secrets in AWS Secrets Manager
echo ""
echo "[4/7] Storing secrets in AWS Secrets Manager..."
echo "  ⚠️  Edit these values before running!"

# Uncomment and set real values:
# aws secretsmanager create-secret \
#     --name "resu-genie/openai-api-key" \
#     --secret-string "your-openai-api-key" \
#     --region $AWS_REGION

# aws secretsmanager create-secret \
#     --name "resu-genie/pinecone-api-key" \
#     --secret-string "your-pinecone-api-key" \
#     --region $AWS_REGION

echo "  (Secrets creation commented out — add your keys manually)"

# STEP 5: Register Task Definition
echo ""
echo "[5/7] Registering ECS Task Definition..."
python aws/task_definition.py | \
    sed "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" > /tmp/task-def.json
aws ecs register-task-definition \
    --cli-input-json file:///tmp/task-def.json \
    --region $AWS_REGION
echo "  ✅ Task definition registered"

# STEP 6: Create ECS Service (if not exists)
echo ""
echo "[6/7] Creating/Updating ECS Service..."
aws ecs create-service \
    --cluster $ECS_CLUSTER \
    --service-name $ECS_SERVICE \
    --task-definition resu-genie-task \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-CHANGEME],securityGroups=[sg-CHANGEME],assignPublicIp=ENABLED}" \
    --region $AWS_REGION \
    2>/dev/null || \
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $ECS_SERVICE \
    --task-definition resu-genie-task \
    --region $AWS_REGION

echo "  ✅ ECS Service created/updated"

# STEP 7: Wait for deployment
echo ""
echo "[7/7] Waiting for service to stabilize..."
aws ecs wait services-stable \
    --cluster $ECS_CLUSTER \
    --services $ECS_SERVICE \
    --region $AWS_REGION

echo ""
echo "==========================================="
echo "  ✅ DEPLOYMENT COMPLETE!"
echo "  Visit your Load Balancer URL to access the app"
echo "==========================================="
