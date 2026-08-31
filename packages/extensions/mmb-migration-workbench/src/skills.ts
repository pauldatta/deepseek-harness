/**
 * Baked-in mature MMB skills registered into DeepSeek Harness ctx.skills.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/skills
 */

import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

export const MMB_RUNTIME_SKILLS: readonly SkillRegistration[] = [
  {
    name: 'mmb-migration-discovery',
    description: 'Workload discovery and multi-cloud migration readiness assessment for AWS, Azure, and on-prem environments moving to Google Cloud.',
    source: 'runtime',
    content: `# MMB Multi-Cloud Discovery & Readiness Assessment Skill

## Purpose
Execute systematic discovery across AWS, Azure, or on-prem workloads to identify candidate databases, compute workloads, and storage buckets for Google Cloud migration.

## Workflow
1. **Workload Inventory**: Inspect VM instances, container clusters, databases (Oracle, SQL Server, Postgres), and object storage buckets.
2. **Network Topology Scan**: Evaluate CIDR blocks, VPC peering, VPN/Interconnect bandwidth requirements, and egress costs.
3. **Data Volume & Throughput Analysis**: Measure database size (GB/TB), change rates (MB/s), and IOPS to determine CDC stream bandwidth.
4. **Target GCP Architecture Mapping**:
   - Oracle Databases -> BigQuery (Analytics/BQML) + AlloyDB for PostgreSQL (OLTP)
   - Kubernetes Ingress -> GKE Gateway API (HTTPRoute)
   - Hadoop / HDFS -> Cloud Storage + BigLake (Iceberg) + Dataproc Serverless
   - Monolithic Applications -> Cloud Run (Serverless Containers)
5. **Call \`mmb_assess_workload\`**: Run automated rubric scoring to calculate calibrated feasibility, risk factors, and recommended blueprints.
`,
  },
  {
    name: 'mmb-oracle-bigquery',
    description: 'Oracle 19c to BigQuery CDC migration with Datastream, FastMCP server integration, and BQML forecasting.',
    source: 'runtime',
    content: `# MMB Oracle to BigQuery Migration & In-Database AI Skill

## Purpose
Migrate proprietary Oracle 19c database workloads to Google Cloud BigQuery and AlloyDB using Datastream CDC and Model Context Protocol (MCP) agents.

## Architecture
- **Source**: Oracle 19c on Compute Engine or on-premises.
- **Ingestion**: Google Cloud Datastream CDC (Change Data Capture) via LogMiner.
- **Staging & Storage**: Cloud Storage staging bucket -> BigQuery bronze tables.
- **Deduplication**: BigQuery scheduled queries or BigQuery Continuous Queries merging CDC changes.
- **Predictive AI**: BigQuery ML \`ARIMA_PLUS\` time-series forecasting and vector search.

## Instructions
1. **Prerequisites Verification**:
   - Ensure Oracle ARCHIVELOG mode and supplemental logging are enabled.
   - Provision dedicated Datastream user with \`SELECT ANY TRANSACTION\`, \`EXECUTE_CATALOG_ROLE\`.
2. **Datastream Stream Creation**:
   - Set up private connectivity configuration (VPC Peering or Cloud VPN).
   - Configure BigQuery destination dataset with automatic schema evolution.
3. **Historical Backfill**:
   - Perform initial table data backfill while tracking SCN (System Change Number).
4. **Validation & Cutover**:
   - Check row counts and cryptographic checksums between Oracle and BigQuery.
   - Run BQML forecasting queries on migrated analytical datasets.
`,
  },
  {
    name: 'mmb-ingress2gateway',
    description: 'Kubernetes Ingress to GKE Gateway API AST translation and HTTPRoute generation.',
    source: 'runtime',
    content: `# MMB Ingress to Gateway API Modernization Skill

## Purpose
Translate legacy Kubernetes \`networking.k8s.io/v1\` Ingress manifests into standard \`gateway.networking.k8s.io/v1\` Gateway and HTTPRoute resources on GKE.

## Rules & Conversion Mapping
1. **GatewayClass Selection**:
   - External Global LB: \`gke-l7-global-external-managed\`
   - Regional Internal LB: \`gke-l7-rilb\`
2. **HTTPRoute Mapping**:
   - Ingress \`spec.rules[].host\` -> HTTPRoute \`spec.hostnames\`
   - Ingress \`spec.rules[].http.paths\` -> HTTPRoute \`spec.rules[].matches\`
   - PathPrefix matching (\`pathType: Prefix\`) -> \`type: PathPrefix\`
   - Exact matching (\`pathType: Exact\`) -> \`type: Exact\`
   - Backend service reference -> \`backendRefs[].name\` and \`backendRefs[].port\`
3. **Execution**:
   - Use the \`mmb_ingress_translate\` tool to execute deterministic manifest translation.
   - Test manifests with \`kubectl apply -f route.yaml --dry-run=client\`.
`,
  },
  {
    name: 'mmb-legacy-detox',
    description: 'PySpark and Hadoop Hive modernization to Dataproc Serverless, BigLake, and Apache Iceberg.',
    source: 'runtime',
    content: `# MMB Legacy Detox: Hadoop & PySpark Modernization Skill

## Purpose
Modernize legacy Cloudera/Hadoop environments, HDFS data lakes, and PySpark batch jobs to Google Cloud Dataproc Serverless and BigLake Iceberg tables.

## Steps
1. **HDFS Storage Migration**:
   - Transfer historical HDFS data to Cloud Storage buckets using Google Cloud Transfer Appliance or Cloud Storage Transfer Service.
2. **Iceberg / BigLake Table Definition**:
   - Define BigLake managed tables on Cloud Storage with Apache Iceberg open table format.
3. **PySpark Code Modernization**:
   - Replace \`hdfs://\` URI schemes with \`gs://\`.
   - Remove hardcoded cluster master configurations (\`spark.master = "yarn"\`).
   - Package PySpark scripts to execute on Dataproc Serverless Batches API.
4. **AST Parity Verification**:
   - Verify SQL dialect compatibility between Spark SQL and BigQuery SQL to eliminate hallucinations.
`,
  },
  {
    name: 'mmb-app-modernization',
    description: 'Java Spring Boot and .NET modernization with build-verification loops, OpenRewrite recipes, and Cloud Run targeting.',
    source: 'runtime',
    content: `# MMB Application Modernization Skill (Java & .NET to Cloud Run)

## Purpose
Refactor enterprise Java (Spring Boot) and .NET applications for containerized deployment on Google Cloud Run and GKE, enforced by automated build-verification loops.

## Guidelines
1. **Java Modernization**:
   - Upgrade Spring Boot 2.x to 3.x, migrating \`javax.*\` to \`jakarta.*\` packages.
   - Adopt Google Cloud Spring starters for Cloud SQL, Pub/Sub, and Cloud Storage.
   - Configure Google Container Tools Jib for distroless, non-root Docker builds.
2. **.NET Modernization**:
   - Migrate .NET Framework (4.7/4.8) to .NET 8 Linux LTS.
   - Replace IIS/WCF dependencies with ASP.NET Core Web APIs.
   - Generate multi-stage Dockerfile targeting \`mcr.microsoft.com/dotnet/aspnet:8.0\`.
3. **Hermetic Verification**:
   - Always run \`mvn test\` or \`dotnet test\` to verify compilation and test passage before completing changes.
`,
  },
  {
    name: 'mmb-alloydb-vector',
    description: 'AlloyDB pgvector + ScaNN and BigQuery Zero-ETL federation for in-database operational AI.',
    source: 'runtime',
    content: `# MMB AlloyDB ScaNN Vector Search & BigQuery Zero-ETL Skill

## Purpose
Design and deploy high-performance operational vector search using AlloyDB for PostgreSQL with the Google ScaNN index and BigQuery zero-copy federation.

## Key Capabilities
1. **AlloyDB pgvector & ScaNN**:
   - Enable \`google_ml_integration\` and \`vector\` extensions in AlloyDB.
   - Use the ScaNN index (\`USING scann (embedding cosine_distance)\`) for up to 10x faster query execution compared to standard HNSW.
2. **BigQuery Federation**:
   - Query AlloyDB transactional tables directly from BigQuery using external data connections (\`EXTERNAL_QUERY\`).
   - Join operational customer data with BigQuery analytics without moving or ETL-ing data.
`,
  },
]
