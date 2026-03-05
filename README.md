# RESU-GENIE — AI Resume Intelligence Platform

> **A production-grade, AWS-native full-stack application** that uploads, parses, scores, and enables RAG chat on any resume — powered by AWS Bedrock AI, OpenSearch vector search, SQS async processing, and a modern React frontend with dark/light mode.

---

## Table of Contents

1. [What It Does](#1-what-it-does)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Data Flow — Upload Pipeline](#4-data-flow--upload-pipeline)
5. [Data Flow — RAG Chat](#5-data-flow--rag-chat)
6. [Data Flow — JD Fit Analysis](#6-data-flow--jd-fit-analysis)
7. [AWS Services Deep-Dive](#7-aws-services-deep-dive)
8. [IAM & Credential Model](#8-iam--credential-model)
9. [Project File Structure](#9-project-file-structure)
10. [Environment Variables](#10-environment-variables)
11. [Local Development Setup](#11-local-development-setup)
12. [AWS Deployment Guide](#12-aws-deployment-guide)
13. [API Reference](#13-api-reference)
14. [Frontend Design System](#14-frontend-design-system)

---

## 1. What It Does

| Feature | Description |
|---|---|
| **Resume Upload** | Drag-and-drop PDF or DOCX. Browser uploads **directly to S3** via a presigned PUT URL — the API server never touches the raw file bytes. |
| **Async AI Processing** | After upload, an SQS message triggers an ECS Worker that runs the full Bedrock AI pipeline independently of the API. |
| **AI Parsing** | AWS Bedrock Claude 3 Sonnet extracts every field from the resume into a structured JSON schema — personal info, experience, education, skills, projects, certifications. |
| **10-Dimension Scoring** | Overall, ATS Compatibility, Experience Relevance, Skills Match, Education, Presentation, Impact Metrics, Keywords, Readability, Completeness — all scored 0–100 by the LLM. |
| **Visual Dashboard** | Radar chart, horizontal bar chart, doughnut chart, animated SVG score rings, work experience timeline, and skill chip grid — all rendered with real Chart.js. |
| **RAG Chat** | Ask anything about the candidate. Titan Embed v2 embeds the question → OpenSearch k-NN finds the top-5 relevant resume chunks → Claude 3 Sonnet constructs an answer with source citations. |
| **JD Fit Analysis** | Paste any job description — Bedrock compares it against the resume and returns a fit score (0–100), verdict, matched/partial/missing skills, and a hiring recommendation. |
| **Resume Vault** | All processed resumes stored in DynamoDB — browse, compare scores, open any for full analysis or chat. |
| **Dark / Light Mode** | System-wide theme toggle in the navbar, persisted to `localStorage`. |
| **Zero Static Keys in Production** | IAM Task Roles provide short-lived credentials to ECS containers via IMDS — no `AWS_ACCESS_KEY_ID` in production. |

---

## 2. Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Web Framework | **Flask** (Python 3.11+) | REST API, route handling |
| WSGI Server | **Gunicorn** | Production-grade HTTP serving |
| AWS SDK | **boto3** | All AWS service calls |
| LLM | **AWS Bedrock — Claude 3 Sonnet** (`anthropic.claude-3-sonnet-20240229-v1:0`) | Resume parsing, RAG chat, JD fit analysis |
| Embeddings | **AWS Bedrock — Titan Embed Text v2** (`amazon.titan-embed-text-v2:0`) | 1024-dimension text embeddings |
| Vector Search | **AWS OpenSearch Serverless** | HNSW k-NN index, cosine similarity |
| Queue | **AWS SQS** + Dead Letter Queue | Async job decoupling |
| Object Storage | **AWS S3** | Raw resume files + result JSON |
| Metadata Store | **AWS DynamoDB** | Job status, resume metadata |
| PDF Extraction | **PyMuPDF** (`fitz`) | Text extraction from PDF files |
| DOCX Extraction | **python-docx** | Text extraction from Word files |
| Auth | **requests-aws4auth** | SigV4 signing for OpenSearch |
| CORS | **flask-cors** | Cross-origin API access |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | **React 18** | Component UI |
| Build Tool | **Vite 7** | Dev server, HMR, production build |
| Routing | **react-router-dom v6** | Client-side SPA routing |
| Charts | **Chart.js 4** + **react-chartjs-2** | All visualizations |
| HTTP | **axios** | API calls with interceptors |
| File Upload | **react-dropzone** | Drag-and-drop upload zone |
| Markdown | **react-markdown** | Renders AI chat responses |
| Animation | **framer-motion** | Transition animations |
| Icons | **lucide-react** | All UI icons |
| Fonts | **Space Grotesk** (headings) + **Plus Jakarta Sans** (body) + **JetBrains Mono** (code) | Google Fonts |
| Styling | **Vanilla CSS** | Custom design system, CSS variables, glassmorphism |

### AWS Infrastructure

| Service | Role |
|---|---|
| **ECS Fargate** | Runs API service + Worker service as containerized tasks — no EC2 management |
| **ECR** | Private Docker image registry (`scanOnPush` CVE scanning) |
| **S3** | Resume storage (`raw/`) + analysis results (`results/`) + frontend SPA hosting |
| **SQS** | Async job queue with DLQ and redrive policy (3 retries) |
| **DynamoDB** | Resume metadata + job status (`PAY_PER_REQUEST`, 90-day TTL) |
| **Bedrock** | Managed LLM inference — Claude 3 Sonnet + Titan Embed v2 |
| **OpenSearch Serverless** | Serverless vector search (VECTORSEARCH collection type) |
| **CloudFront** | CDN for React SPA — edge caching, DDoS protection |
| **ALB** | Application Load Balancer for ECS API service |
| **CloudWatch Logs** | Container log aggregation and metric monitoring |
| **IAM** | Task roles for least-privilege access — no static keys in production |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           USER BROWSER                                   │
│          React (Vite) · Chart.js · react-dropzone · react-markdown       │
│          Dark/Light Mode · Glassmorphism UI · Canvas Particle BG         │
└─────────┬────────────────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        AWS CloudFront CDN                                │
│  · Serves React SPA from S3 (frontend bucket)                            │
│  · Forwards /api/* to ALB origin                                         │
│  · 400+ global PoPs · automatic DDoS mitigation                          │
└─────────┬────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                   Application Load Balancer (ALB)                        │
│  · Routes to ECS API Service target group                                │
│  · Health check: GET /api/health                                         │
└─────────┬────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────────────────────┐
│               ECS Fargate Cluster — "resu-genie-cluster"                 │
│                                                                          │
│  ┌─────────────────────────────┐    ┌──────────────────────────────────┐ │
│  │   API Service (Task Role A) │    │  Worker Service  (Task Role B)   │ │
│  │   Flask + Gunicorn          │    │  SQS long-poll consumer loop     │ │
│  │   Port 5000 · 2 tasks       │    │  1 task (scales with queue)      │ │
│  │                             │    │                                  │ │
│  │  POST /api/upload/presign   │    │  Per SQS message:                │ │
│  │  POST /api/upload/complete  │    │  1. S3.GetObject → raw file      │ │
│  │  GET  /api/status/:id       │    │  2. PyMuPDF / python-docx        │ │
│  │  POST /api/chat             │    │  3. Bedrock Claude 3: parse      │ │
│  │  POST /api/jd-fit           │    │  4. Bedrock Titan v2: embed      │ │
│  │  GET  /api/resumes          │    │  5. OpenSearch: bulk index       │ │
│  │  GET  /api/health           │    │  6. S3.PutObject results/        │ │
│  │                             │    │  7. DynamoDB: status = complete  │ │
│  │  IAM Permissions:           │    │  8. SQS.DeleteMessage (ack)      │ │
│  │  · s3:PutObject (presign)   │    │                                  │ │
│  │  · sqs:SendMessage          │    │  IAM Permissions:                │ │
│  │  · dynamodb:GetItem/Scan    │    │  · sqs:ReceiveMessage+Delete     │ │
│  │  · bedrock:InvokeModel      │    │  · s3:GetObject(raw/)            │ │
│  │  · aoss:APIAccessAll        │    │  · s3:PutObject(results/)        │ │
│  └──────────────┬──────────────┘    │  · dynamodb:PutItem              │ │
│                 │                   │  · bedrock:InvokeModel           │ │
└─────────────────┼───────────────────│  · aoss:APIAccessAll             │ │
                  │                   └──────────────────────────────────┘ │
                  │                                                         │
     ┌────────────┼────────────────────────────────────────────┐
     │            │           AWS Managed Services              │
     │            │                                             │
     │  ┌─────────▼──────┐  ┌──────────────┐  ┌─────────────┐ │
     │  │   AWS S3       │  │   AWS SQS    │  │ AWS DynamoDB│ │
     │  │                │  │              │  │             │ │
     │  │ raw/           │  │ Main Queue   │  │ resu-genie- │ │
     │  │  └ YYYY/MM/DD/ │  │   ↓ 3 fails  │  │ metadata    │ │
     │  │    resume.pdf  │  │ Dead Letter  │  │             │ │
     │  │ results/       │  │   Queue      │  │ resume_id   │ │
     │  │  └ resume_id/  │  │              │  │ status      │ │
     │  │    analysis.   │  │ Visibility   │  │ scores_json │ │
     │  │    json        │  │ timeout 300s │  │ TTL 90 days │ │
     │  └────────────────┘  └──────────────┘  └─────────────┘ │
     │                                                          │
     │  ┌─────────────────────────┐  ┌───────────────────────┐ │
     │  │   AWS Bedrock           │  │  OpenSearch Serverless │ │
     │  │                         │  │  (VECTORSEARCH)        │ │
     │  │  Claude 3 Sonnet:       │  │                        │ │
     │  │  · Parse resume → JSON  │  │  Index mapping:        │ │
     │  │  · RAG chat answers     │  │  · knn_vector: 1024 d  │ │
     │  │  · JD fit analysis      │  │  · HNSW: cosinesimil   │ │
     │  │                         │  │  · Filter by resume_id │ │
     │  │  Titan Embed v2:        │  │  · SigV4 auth (aoss)   │ │
     │  │  · 1024-dim embeddings  │  │                        │ │
     │  │  · Query + index time   │  │  Chunking: 500 words   │ │
     │  │  · IAM auth, no key     │  │  Overlap: 50 words     │ │
     │  └─────────────────────────┘  └───────────────────────┘ │
     └──────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow — Upload Pipeline

The upload flow is split into **two distinct server interactions** and **one direct-to-S3 upload**, making the API server stateless with respect to file bytes.

```
Step 1   Browser → POST /api/upload/presign
         Body: { filename: "resume.pdf", content_type: "application/pdf" }

Step 2   API Server:
         · Generates resume_id = uuid4()
         · Calls s3.generate_presigned_url('put_object', ...)
           - Bucket: resu-genie-resumes
           - Key: raw/YYYY/MM/DD/<resume_id>.pdf
           - ContentType: application/pdf
           - ServerSideEncryption: AES256
           - ExpiresIn: 600 (10 minutes)
         · Returns { resume_id, upload_url, s3_key }

Step 3   Browser → PUT <upload_url>  (raw file bytes)
         ⚡ Goes DIRECTLY to S3 — API server not involved at all!
         Headers: Content-Type: application/pdf

Step 4   Browser → POST /api/upload/complete
         Body: { resume_id, s3_key, filename }

Step 5   API Server:
         · DynamoDB.put_item: { resume_id, status: "pending", filename, s3_key }
         · SQS.send_message: { resume_id, s3_key, filename, submitted_at }
         · Returns { success: true, resume_id, async: true }

Step 6   Browser polls GET /api/status/<resume_id> every 5 seconds

──────────────────────────────────────────
  ASYNC: ECS Worker (separate container)
──────────────────────────────────────────

Step 7   Worker long-polls SQS (20s wait time)
         Receives message: { resume_id, s3_key, filename }

Step 8   Worker → S3.GetObject: raw/<date>/<resume_id>.pdf → /tmp/<resume_id>.pdf

Step 9   Worker extracts text:
         · PDF:  PyMuPDF  (fitz.open)
         · DOCX: python-docx (Document.paragraphs)

Step 10  Worker → Bedrock Claude 3 Sonnet:
         · Sends resume text + structured JSON schema prompt
         · Claude returns: { personal_info, experience, education, skills,
                             certifications, projects, scores, strengths,
                             improvements, keyword_analysis, career_level,
                             recommended_roles }

Step 11  Worker → Bedrock Titan Embed v2 (for each 500-word chunk):
         · Chunk text with 50-word overlap
         · Get 1024-dim embedding vector
         · Store to OpenSearch via bulk API

Step 12  Worker → S3.PutObject: results/<resume_id>/analysis.json
         (Full parsed result stored here — DynamoDB item size limit is 400KB)

Step 13  Worker → DynamoDB.put_item:
         { resume_id, status: "complete", full_result_s3: "results/..." }

Step 14  Worker → SQS.delete_message (acknowledges successful processing)
         (If Worker crashes before this, message reappears after 300s visibility timeout)

──────────────────────────────────────────
  POLL RESOLVES
──────────────────────────────────────────

Step 15  GET /api/status/<resume_id> returns:
         { status: "complete", data: <loads from S3 results/...> }

Step 16  Browser navigates to /analysis — full visual dashboard renders
```

---

## 5. Data Flow — RAG Chat

```
User types: "What is this candidate's most impressive achievement?"
       │
       ▼
POST /api/chat
Body: { message, resume_id, history: [...last 10 turns] }
       │
       ▼
API → Bedrock Titan Embed v2
     Input:  message text (up to 8192 tokens)
     Output: 1024-dim float[] vector
       │
       ▼
API → OpenSearch k-NN search
     Query:  knn vector match on ‹embedding›
     Filter: resume_id = <this resume only>   ← multi-tenant isolation
     top_k:  5 most semantically similar chunks
     Returns: [ { text, score, chunk_index }, ... ]
       │
       ▼
API → Bedrock Claude 3 Sonnet (Messages API)
     System: "You are RESU-GENIE, an expert AI career counselor..."
     Context: 5 retrieved resume chunks (with relevance scores)
     History: last 10 conversation turns (injected as messages[])
     User:    original question
     Params:  temperature=0.3, max_tokens=1024
       │
       ▼
Response: { response: "<markdown answer>", sources: [ {section, relevance} ] }
       │
       ▼
Frontend renders markdown with source citation chips
```

---

## 6. Data Flow — JD Fit Analysis

```
User pastes job description (min 20 words) on the Analysis page
       │
       ▼
POST /api/jd-fit
Body: { jd_text, resume_id }
       │
       ▼
API → Bedrock Titan Embed v2
     Embeds the job description text (up to 3000 chars)
     Output: 1024-dim JD embedding vector
       │
       ▼
API → OpenSearch k-NN search
     Finds top 8 resume chunks most relevant to the JD
     Filter: resume_id = <this resume>
       │
       ▼
API → Bedrock Claude 3 Sonnet
     Prompt: JD text + retrieved resume context
     Claude returns JSON:
     {
       fit_score:            0-100 integer,
       verdict:              "Strong Fit" | "Good Fit" | "Partial Fit" | "Low Fit",
       summary:              "2-sentence match summary",
       personalized_message: "Direct advice to the candidate",
       matched_skills:       ["skill", ...],
       partial_skills:       ["skill", ...],
       missing_skills:       ["skill", ...],
       dimension_scores: {
         technical_skills, experience_level,
         domain_knowledge, leadership, education
       },
       recommendation:       "3-4 sentence recruiter-facing recommendation"
     }
       │
       ▼
Frontend renders: score ring + verdict banner + skill grids + dimension bars
```

---

## 7. AWS Services Deep-Dive

### S3 — Object Storage

- **Two logical namespaces in one bucket:**
  - `raw/YYYY/MM/DD/<resume_id>.<ext>` — original uploaded file (30-day lifecycle rule)
  - `results/<resume_id>/analysis.json` — full parsed analysis (kept indefinitely)
- **Why results in S3 and not DynamoDB?** DynamoDB has a 400KB per-item limit. A fully parsed resume with vectors can exceed this. S3 has no practical size limit.
- **Presigned URLs:** The API signs a URL with its IAM role. The browser uses that URL directly against S3 — zero bytes pass through the API server. This reduces API bandwidth, latency, and cost.
- **AES-256 encryption at rest** enforced via bucket policy.
- **All public access blocked** — files accessible only via presigned URLs or IAM.

### SQS — Async Job Queue

- **Standard queue** (not FIFO — order doesn't matter for resume processing).
- **Visibility timeout: 300 seconds** — if the Worker crashes while processing, the message reappears after 5 minutes and another Worker picks it up.
- **Long polling (20s)** — reduces empty receives and API calls vs short polling.
- **Dead Letter Queue (DLQ):** After 3 failed receive+visibility cycles, the message moves to the DLQ where it can be inspected without loss.
- **`maxReceiveCount: 3`** in the redrive policy.

### DynamoDB — Status & Metadata

- **Partition key:** `resume_id` (UUID string)
- **`status` field:** `pending` → `processing` → `complete` | `failed`
- **`full_result_s3`:** S3 key pointing to the full analysis JSON (API loads it on status=complete)
- **`PAY_PER_REQUEST`** billing — no capacity planning needed
- **90-day TTL** — items auto-expire via the `ttl` epoch timestamp field

### Bedrock — Claude 3 Sonnet

- **Model ID:** `anthropic.claude-3-sonnet-20240229-v1:0`
- **API style:** Messages API (not legacy text completion)
- **Resume parsing:** `temperature=0.1` (deterministic), `max_tokens=4096`
- **RAG chat:** `temperature=0.3` (slightly creative), `max_tokens=1024`
- **JD Fit:** `temperature=0.2`, `max_tokens=1024`
- **JSON extraction:** Claude's response is trimmed between first `{` and last `}` — handles any surrounding explanation text.
- **IAM auth** via boto3 — no Anthropic API key required. Model access must be enabled in the Bedrock console.

### Bedrock — Titan Embed Text v2

- **Model ID:** `amazon.titan-embed-text-v2:0`
- **Output dimensions:** 1024 (configured in request body)
- **`normalize: true`** — returns L2-normalized vectors (required for cosine similarity)
- **Input limit:** 8192 tokens
- **Used at:** index time (each 500-word chunk) and query time (each user question or JD text)

### OpenSearch Serverless — Vector Search

- **Collection type:** `VECTORSEARCH`
- **Index name:** `resu-genie-vectors`
- **Vector field:** `embedding` — 1024-dim `knn_vector`
- **Algorithm:** HNSW (Hierarchical Navigable Small World)
- **Metric:** `cosinesimil` (cosine similarity)
- **Parameters:** `ef_construction=128`, `m=24`
- **Multi-tenant isolation:** Every chunk document has a `resume_id` field. All queries use a `bool.filter` on `resume_id` — each resume's chunks are isolated without needing separate indexes.
- **Auth:** AWS SigV4 signing via `requests-aws4auth` with `service='aoss'`
- **Chunking strategy:** 500 words per chunk, 50-word overlap — ensures no context is lost at boundaries

---

## 8. IAM & Credential Model

### Why No Static Keys in Production

```bash
# ❌ NEVER — static keys in .env or code
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret...
```

Static keys are long-lived, overpowered, and catastrophic if leaked. They can't be automatically rotated. They show up in logs, docker inspect, and environment dumps.

### How It Works in Production: IAM Task Roles

ECS Fargate supports **Task Roles** — an IAM role bound to each container task definition. When boto3 makes any AWS API call without explicit credentials, it automatically fetches **short-lived, auto-rotating credentials** from the IMDS endpoint:

```
boto3.client('s3')  ← no keys provided
  │
  ▼
boto3 Credential Provider Chain:
  1. Environment variables        → empty in production ECS
  2. ~/.aws/credentials           → doesn't exist in container
  3. IMDS: 169.254.169.254/latest/meta-data/iam/security-credentials/
     └── Returns { AccessKeyId, SecretAccessKey, Token, Expiration (15 min) }
         Auto-refreshed by ECS before expiry ← THIS is used in production
```

### Two Separate Task Roles (Least Privilege)

| Role | Attached To | Permissions Granted |
|---|---|---|
| `resu-genie-api-task-role` | Flask API service | `s3:PutObject` (presign only), `sqs:SendMessage`, `dynamodb:GetItem`, `dynamodb:Scan`, `bedrock:InvokeModel`, `aoss:APIAccessAll` |
| `resu-genie-worker-task-role` | SQS Worker service | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `s3:GetObject` (raw/), `s3:PutObject` (results/), `dynamodb:PutItem`, `bedrock:InvokeModel`, `aoss:APIAccessAll` |
| `ecsTaskExecutionRole` | Both services | `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `logs:CreateLogStream`, `logs:PutLogEvents` |

Note: The API cannot consume SQS. The Worker cannot send SQS. Neither can delete S3 objects or DynamoDB tables. This is the **principle of least privilege** applied at the service level.

### Locally

boto3 reads credentials from `~/.aws/credentials` (populated by `aws configure`) or falls back to `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in your `.env`. The `.env` file is gitignored and exists only on your local machine.

---

## 9. Project File Structure

```
RESU-Genie_AWS/
│
├── .env                              # Local config — AWS keys LOCAL ONLY, gitignored
├── .gitignore
├── README.md
├── start.bat                         # Windows one-click dev starter
├── docker-compose.yml                # Local dev: api + worker side by side
│
├── Dockerfile                        # ECS API image — Python 3.11 + Flask + Gunicorn
├── Dockerfile.worker                 # ECS Worker image — Python 3.11 + SQS consumer
│
├── .github/
│   └── workflows/
│       └── deploy.yml                # GitHub Actions: test → ECR push → ECS rolling update
│
├── aws/
│   ├── provision.py                  # One-time provisioner: S3 + SQS + DynamoDB + OpenSearch
│   ├── deploy.sh                     # Manual deploy: docker build → ECR push → ECS update
│   ├── task_definition.py            # ECS task definition JSON generator
│   └── iam/
│       ├── api-task-role-policy.json    # Least-privilege policy for API ECS task
│       └── worker-task-role-policy.json # Least-privilege policy for Worker ECS task
│
├── backend/
│   ├── app.py                        # Flask app — all API routes
│   │     POST /api/upload/presign    #   Generate S3 presigned PUT URL
│   │     POST /api/upload/complete   #   Publish SQS job + save DynamoDB pending
│   │     GET  /api/status/:id        #   Poll job status → load result from S3
│   │     POST /api/chat              #   RAG: Titan embed → OpenSearch → Claude
│   │     POST /api/jd-fit            #   JD comparison: embed JD → fetch chunks → Claude
│   │     GET  /api/resumes           #   DynamoDB scan → list all resume metadata
│   │     GET  /api/health            #   Health check endpoint
│   │
│   ├── requirements.txt
│   │     flask, flask-cors, gunicorn
│   │     boto3, botocore
│   │     PyMuPDF (fitz), python-docx
│   │     opensearch-py, requests-aws4auth
│   │     python-dotenv
│   │
│   ├── services/
│   │   ├── aws_service.py            # S3 presign, SQS publish, DynamoDB CRUD, S3 result I/O
│   │   ├── bedrock_service.py        # Claude 3 (parse + chat + JD-fit), Titan Embed v2
│   │   ├── vector_service.py         # OpenSearch: index creation, bulk insert, k-NN query
│   │   ├── parser_service.py         # Text extraction: PyMuPDF + python-docx
│   │   └── ai_service.py             # Shared AI utilities
│   │
│   └── worker/
│       └── worker.py                 # SQS long-poll loop → download → parse → embed → save → ack
│
└── frontend/
    ├── package.json
    │     react@18, react-dom@18, react-router-dom@6
    │     chart.js@4, react-chartjs-2@5
    │     axios, react-dropzone, react-markdown
    │     framer-motion, lucide-react
    │     vite@7, @vitejs/plugin-react
    │
    ├── vite.config.js                # Dev server port 3000 + /api proxy to :5000
    ├── index.html                    # HTML shell — Google Fonts, SEO meta tags
    ├── Dockerfile.frontend           # Multi-stage: Vite build → Nginx serve
    ├── nginx.conf                    # SPA routing fallback + /api proxy + gzip + cache headers
    │
    └── src/
        ├── main.jsx                  # ReactDOM.createRoot + BrowserRouter
        ├── App.jsx                   # Routes + ThemeProvider + ResumeContext + ParticleBackground
        ├── index.css                 # Design system: CSS tokens, glassmorphism, animations
        │
        ├── context/
        │   ├── ResumeContext.js      # Global state: resumeData, setResumeData
        │   └── ThemeContext.jsx      # Theme state: dark/light, toggle, localStorage persist
        │
        ├── components/
        │   ├── Navbar.jsx            # Fixed glassmorphism navbar + dark/light toggle
        │   └── ParticleBackground.jsx# Canvas-based animated particle network
        │
        └── pages/
            ├── LandingPage.jsx       # Immersive hero + 3D tilt feature cards + arch flow
            ├── UploadPage.jsx        # Dropzone + 7-step animated AWS pipeline progress
            ├── AnalysisPage.jsx      # Full dashboard: 4 charts + rings + timeline + JD fit
            ├── ChatPage.jsx          # RAG chat: markdown render + typing indicator + suggestions
            └── HistoryPage.jsx       # Resume vault: stats row + score cards + quick navigation
```

---

## 10. Environment Variables

```bash
# ──────────────────────────────────────────
# APPLICATION
# ──────────────────────────────────────────
APP_PORT=5000
APP_ENV=development          # Set to 'production' to disable Flask debug mode
SECRET_KEY=change-this-key   # Flask session signing key

# ──────────────────────────────────────────
# AWS REGION — all services must match
# ──────────────────────────────────────────
AWS_REGION=us-east-1

# ──────────────────────────────────────────
# AWS CREDENTIALS — LOCAL DEV ONLY
# In ECS production: IAM task role via IMDS
# These are NOT set in production environment
# ──────────────────────────────────────────
AWS_ACCESS_KEY_ID=           # local dev only
AWS_SECRET_ACCESS_KEY=       # local dev only

# ──────────────────────────────────────────
# S3
# ──────────────────────────────────────────
S3_BUCKET_NAME=resu-genie-resumes

# ──────────────────────────────────────────
# SQS — fill after running aws/provision.py
# ──────────────────────────────────────────
SQS_QUEUE_NAME=resu-genie-jobs
SQS_DLQ_NAME=resu-genie-jobs-dlq
SQS_QUEUE_URL=               # e.g. https://sqs.us-east-1.amazonaws.com/123456/resu-genie-jobs

# ──────────────────────────────────────────
# DYNAMODB
# ──────────────────────────────────────────
DYNAMODB_TABLE_NAME=resu-genie-metadata

# ──────────────────────────────────────────
# BEDROCK — IAM auth only, no API key needed
# Enable both models in AWS Console:
# Bedrock → Model Access → Request Access
#   ✅ Anthropic Claude 3 Sonnet
#   ✅ Amazon Titan Embeddings V2
# ──────────────────────────────────────────
BEDROCK_LLM_MODEL=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0

# ──────────────────────────────────────────
# OPENSEARCH SERVERLESS — fill after provisioner
# ──────────────────────────────────────────
OPENSEARCH_ENDPOINT=         # e.g. https://abc123xyz.us-east-1.aoss.amazonaws.com
OPENSEARCH_INDEX_NAME=resu-genie-vectors
```

---

## 11. Local Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| AWS CLI | 2+ | [aws.amazon.com/cli](https://aws.amazon.com/cli) |
| Docker | 24+ | [docker.com](https://docker.com) (optional) |

### Quick Start

```bash
# Clone the project
cd c:\rugved\RESU-Genie_AWS

# ── Terminal 1: Backend ──────────────────────────────
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python app.py
# Flask API running on http://localhost:5000

# ── Terminal 2: Frontend ─────────────────────────────
cd frontend
npm install
npm run dev
# Vite dev server on http://localhost:3000
# /api/* proxied to localhost:5000

# ── Terminal 3: Worker (optional, needs real AWS) ────
cd backend
python worker/worker.py
# Long-polls SQS and processes jobs
```

Or use the one-click launcher on Windows:

```bat
start.bat
```

### Running with Real AWS

```bash
# 1. Configure AWS CLI credentials (local dev only)
aws configure
# Access Key ID:     <from IAM → Users → Security credentials>
# Secret Access Key: <same>
# Default region:    us-east-1
# Output format:     json

# 2. Enable Bedrock model access
# AWS Console → Bedrock → Model access → Request access:
#   ✅ Anthropic Claude 3 Sonnet
#   ✅ Amazon Titan Embeddings V2

# 3. Provision all AWS infrastructure (run once)
python aws/provision.py
# Copy the output: SQS_QUEUE_URL and OPENSEARCH_ENDPOINT

# 4. Update .env with outputs from provisioner
SQS_QUEUE_URL=<from step 3>
OPENSEARCH_ENDPOINT=<from step 3>

# 5. Start all three services
python backend/app.py &
python backend/worker/worker.py &
cd frontend && npm run dev
```

---

## 12. AWS Deployment Guide

### Phase 1 — Provision Infrastructure

```bash
# Run once — creates S3, SQS + DLQ, DynamoDB, OpenSearch Serverless
python aws/provision.py

# Or manually:
aws s3 mb s3://resu-genie-resumes --region us-east-1
aws s3api put-public-access-block --bucket resu-genie-resumes \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws dynamodb create-table \
    --table-name resu-genie-metadata \
    --attribute-definitions AttributeName=resume_id,AttributeType=S \
    --key-schema AttributeName=resume_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

aws dynamodb update-time-to-live \
    --table-name resu-genie-metadata \
    --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

### Phase 2 — IAM Roles

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# API Task Role
aws iam create-role --role-name resu-genie-api-task-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name resu-genie-api-task-role \
    --policy-name resu-genie-api-policy \
    --policy-document file://aws/iam/api-task-role-policy.json

# Worker Task Role
aws iam create-role --role-name resu-genie-worker-task-role \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam put-role-policy --role-name resu-genie-worker-task-role \
    --policy-name resu-genie-worker-policy \
    --policy-document file://aws/iam/worker-task-role-policy.json

# ECS Task Execution Role (pull images + write logs)
aws iam create-role --role-name ecsTaskExecutionRole \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### Phase 3 — ECR & Docker Images

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1
ECR_BASE=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create registries
aws ecr create-repository --repository-name resu-genie-api --image-scanning-configuration scanOnPush=true
aws ecr create-repository --repository-name resu-genie-worker --image-scanning-configuration scanOnPush=true

# Authenticate Docker
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_BASE

# Build and push API
docker build -t resu-genie-api .
docker tag resu-genie-api:latest $ECR_BASE/resu-genie-api:latest
docker push $ECR_BASE/resu-genie-api:latest

# Build and push Worker
docker build -f Dockerfile.worker -t resu-genie-worker .
docker tag resu-genie-worker:latest $ECR_BASE/resu-genie-worker:latest
docker push $ECR_BASE/resu-genie-worker:latest
```

### Phase 4 — ECS Fargate Cluster & Services

```bash
# Create cluster
aws ecs create-cluster --cluster-name resu-genie-cluster \
    --capacity-providers FARGATE FARGATE_SPOT

# Create log groups
aws logs create-log-group --log-group-name /ecs/resu-genie/api
aws logs create-log-group --log-group-name /ecs/resu-genie/worker

# Register task definitions (fills in ECR image URLs, IAM role ARNs, env vars)
python aws/task_definition.py api > /tmp/api-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/api-task.json

python aws/task_definition.py worker > /tmp/worker-task.json
aws ecs register-task-definition --cli-input-json file:///tmp/worker-task.json

# Create API service (attached to ALB)
aws ecs create-service \
    --cluster resu-genie-cluster \
    --service-name resu-genie-api \
    --task-definition resu-genie-api \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=<tg-arn>,containerName=api,containerPort=5000"

# Create Worker service
aws ecs create-service \
    --cluster resu-genie-cluster \
    --service-name resu-genie-worker \
    --task-definition resu-genie-worker \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}"
```

### Rolling Deploy (CI/CD)

```bash
# Push new image → trigger ECS rolling update
bash aws/deploy.sh
# Or via GitHub Actions on push to main branch
```

---

## 13. API Reference

All endpoints under `/api/`. In local dev, Vite proxies `/api/*` → `http://localhost:5000`.

### `POST /api/upload/presign`

Request a presigned S3 PUT URL. Call this before uploading.

**Request body:**
```json
{ "filename": "resume.pdf", "content_type": "application/pdf" }
```

**Response:**
```json
{
  "resume_id": "550e8400-e29b-41d4-a716-446655440000",
  "upload_url": "https://resu-genie-resumes.s3.amazonaws.com/raw/2026/03/05/550e...?X-Amz-Signature=...",
  "s3_key": "raw/2026/03/05/550e8400-e29b-41d4-a716-446655440000.pdf"
}
```

### `PUT <upload_url>`

**Direct browser-to-S3 upload.** This call goes to S3, not the API server.

```
Headers: Content-Type: application/pdf
Body:    raw file bytes
```

### `POST /api/upload/complete`

Notify the API that the S3 upload succeeded. Triggers SQS job.

**Request body:**
```json
{ "resume_id": "550e...", "s3_key": "raw/2026/03/05/550e....pdf", "filename": "resume.pdf" }
```

**Response:**
```json
{ "success": true, "resume_id": "550e...", "status": "pending", "async": true }
```

### `GET /api/status/<resume_id>`

Poll for worker completion. Call every 5 seconds.

**Response (pending):**
```json
{ "status": "pending", "resume_id": "550e..." }
```

**Response (complete):**
```json
{
  "status": "complete",
  "resume_id": "550e...",
  "data": {
    "parsed": { "personal_info": {...}, "experience": [...], "education": [...], "skills": {...} },
    "scores": { "overall": 87, "ats_compatibility": 84, "experience_relevance": 91, ... },
    "strengths": [...],
    "improvements": [...],
    "keyword_analysis": { "found": [...], "missing": [...] },
    "career_level": "Senior Engineer",
    "recommended_roles": [...]
  }
}
```

### `POST /api/chat`

RAG-powered Q&A about the resume.

**Request body:**
```json
{
  "message": "What was their most impressive technical achievement?",
  "resume_id": "550e...",
  "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }]
}
```

**Response:**
```json
{
  "response": "## Key Achievement\n\nAt Google...",
  "sources": [
    { "section": "Chunk 3", "relevance": 0.924 },
    { "section": "Chunk 7", "relevance": 0.881 }
  ]
}
```

### `POST /api/jd-fit`

Compare a resume against a job description.

**Request body:**
```json
{ "jd_text": "Senior Software Engineer at...", "resume_id": "550e..." }
```

**Response:**
```json
{
  "fit_score": 82,
  "verdict": "Good Fit",
  "summary": "Strong Python and AWS alignment. Leadership experience is a partial match.",
  "personalized_message": "You are a strong candidate. Highlight your Kubernetes experience.",
  "matched_skills": ["Python", "AWS", "Distributed Systems"],
  "partial_skills": ["Kubernetes", "Team Leadership"],
  "missing_skills": ["Rust", "gRPC"],
  "dimension_scores": {
    "technical_skills": 88,
    "experience_level": 85,
    "domain_knowledge": 80,
    "leadership": 70,
    "education": 90
  },
  "recommendation": "This candidate aligns well with the core technical requirements..."
}
```

### `GET /api/resumes`

List all analyzed resumes from DynamoDB.

**Response:**
```json
{
  "resumes": [
    {
      "resume_id": "550e...",
      "name": "Jane Doe",
      "filename": "resume.pdf",
      "status": "complete",
      "career_level": "Senior Engineer",
      "overall_score": "87",
      "updated_at": "2026-03-05T10:20:00Z"
    }
  ]
}
```

### `GET /api/health`

Health check — used by ALB.

**Response:**
```json
{
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
}
```

---

## 14. Frontend Design System

The UI is built on a custom CSS design system using CSS custom properties — no Tailwind, no component library.

### Theme System

A `[data-theme]` attribute on `<html>` drives all color tokens. Switching themes updates a single attribute and every component responds via CSS variables — no JavaScript style manipulation needed.

```css
/* Dark mode (default) */
[data-theme="dark"] {
  --bg-base:       #03040a;
  --glass-bg:      rgba(12, 16, 36, 0.55);
  --text-1:        rgba(240, 246, 255, 0.97);
  --accent:        #5b72f9;
  --accent-glow:   rgba(91, 114, 249, 0.35);
}

/* Light mode */
[data-theme="light"] {
  --bg-base:       #f0f4ff;
  --glass-bg:      rgba(235, 241, 255, 0.70);
  --text-1:        #0a0f2c;
  --accent:        #4a5ef0;
}
```

Theme preference is persisted to `localStorage` via `ThemeContext.jsx` and applied before React hydrates (no flash of wrong theme).

### Key Design Patterns

| Pattern | Implementation |
|---|---|
| **Glassmorphism cards** | `backdrop-filter: blur(20px) saturate(180%)` + semi-transparent backgrounds |
| **Ambient glow background** | Two `::before`/`::after` pseudo-elements with `radial-gradient` orbs animated via `@keyframes aurora-drift` |
| **Particle network** | Canvas 2D API — floating nodes with inter-node connection lines, adapts to theme color |
| **3D tilt cards** | Mouse `onMouseMove` → `perspective(800px) rotateX() rotateY()` via JavaScript |
| **Staggered entrance** | CSS `animation-delay` increments per element + `slide-up` keyframes |
| **Active nav indicator** | Absolutely-positioned gradient line with `box-shadow` glow under active link |
| **Button beam shimmer** | Absolutely-positioned `::before` element with `translateX()` animation |
| **Score rings** | SVG `<circle>` with `stroke-dasharray` + `stroke-dashoffset` animated by CSS transition |

### Backward Compatibility

Old CSS variable names (`--text-primary`, `--text-secondary`, `--text-muted`, `--surface-*`, `--border-*`) are aliased to the new tokens in `index.css`, ensuring existing pages work without a full rewrite:

```css
:root, [data-theme="dark"], [data-theme="light"] {
  --text-primary:   var(--text-1);
  --text-secondary: var(--text-2);
  --text-muted:     var(--text-3);
  --surface-1:      var(--bg-1);
  --border-2:       var(--glass-border-h);
}
```

---

*Built with AWS Bedrock · OpenSearch Serverless · ECS Fargate · React · Vite*
