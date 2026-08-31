/**
 * Modernization Recipes for automated code and architecture transformation.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/recipes
 */

import type { ModernizationRecipe, RecipeRunResult } from './types.ts'

export const MODERNIZATION_RECIPES: readonly ModernizationRecipe[] = [
  {
    id: 'java-spring-boot-3',
    title: 'Spring Boot 2.x to 3.x Migration (Java 17/21 Baseline)',
    category: 'java',
    description: 'Upgrades Spring Boot 2.7 to 3.2, switches javax.* to jakarta.* imports, configures Spring Cloud GCP starters, and enables native compilation.',
    sourcePattern: 'javax.persistence.*, org.springframework.boot:2.7.*',
    targetPattern: 'jakarta.persistence.*, com.google.cloud:spring-cloud-gcp-dependencies',
    verificationCommand: 'mvn clean test -Dtest=*Test',
  },
  {
    id: 'java-cloud-run-containerization',
    title: 'Java Cloud Run Containerization (Jib / Distroless)',
    category: 'java',
    description: 'Generates non-root distroless container build with Google Container Tools Jib plugin, setting optimized JVM flags (-XX:MaxRAMPercentage=75).',
    sourcePattern: 'Standard jar build without container definition',
    targetPattern: 'com.google.cloud.tools:jib-maven-plugin with gcr.io/distroless/java21-debian12',
    verificationCommand: 'mvn compile jib:dockerBuild',
  },
  {
    id: 'dotnet-core-cloud-run',
    title: '.NET Framework to .NET 8 Linux Container Migration',
    category: 'dotnet',
    description: 'Refactors Windows-dependent IIS/ASP.NET MVC patterns to ASP.NET Core 8 minimal APIs, multi-stage Linux Dockerfile, and Cloud SQL Auth Proxy.',
    sourcePattern: '<TargetFramework>net472</TargetFramework>, System.Web.Mvc',
    targetPattern: '<TargetFramework>net8.0</TargetFramework>, Microsoft.AspNetCore.App',
    verificationCommand: 'dotnet test --logger "console;verbosity=detailed"',
  },
  {
    id: 'pyspark-to-dataproc-serverless',
    title: 'PySpark to Dataproc Serverless & BigLake Modernization',
    category: 'data',
    description: 'Converts legacy HDFS file paths (hdfs://namenode/...) to Google Cloud Storage (gs://...) and registers Dataproc Serverless Batches API execution.',
    sourcePattern: 'hdfs://namenode:8020/data/raw/*.parquet',
    targetPattern: 'gs://${GCS_LAKEHOUSE_BUCKET}/data/raw/*.parquet via spark.read.format("biglake")',
    verificationCommand: 'gcloud dataproc batches submit pyspark --dry-run',
  },
  {
    id: 'oracle-plsql-to-bigquery',
    title: 'Oracle PL/SQL to BigQuery SQL Transformation',
    category: 'database',
    description: 'Translates Oracle specific syntax (NVL, DECODE, SYSDATE, (+) outer joins, CONNECT BY) into BigQuery standard SQL (COALESCE, CASE WHEN, CURRENT_TIMESTAMP).',
    sourcePattern: 'NVL(val, 0), DECODE(status, 1, "Active"), SYSDATE',
    targetPattern: 'COALESCE(val, 0), CASE status WHEN 1 THEN "Active" END, CURRENT_TIMESTAMP()',
    verificationCommand: 'bq query --dry_run --use_legacy_sql=false',
  },
  {
    id: 'k8s-ingress-to-gateway-api',
    title: 'Kubernetes Ingress to GKE Gateway API',
    category: 'k8s',
    description: 'Replaces legacy networking.k8s.io/v1 Ingress with GKE Gateway API HTTPRoute and Global External Managed GatewayClass.',
    sourcePattern: 'apiVersion: networking.k8s.io/v1, kind: Ingress',
    targetPattern: 'apiVersion: gateway.networking.k8s.io/v1, kind: HTTPRoute / Gateway',
    verificationCommand: 'kubectl apply -f route.yaml --dry-run=client',
  },
]

export function runModernizationRecipe(recipeId: string, dryRun = true): RecipeRunResult {
  const recipe = MODERNIZATION_RECIPES.find(r => r.id === recipeId)
  if (!recipe) {
    return {
      recipeId,
      title: 'Unknown Recipe',
      status: 'failed',
      changesCount: 0,
      description: `Recipe with id "${recipeId}" was not found in MMB workbench catalog.`,
      verificationSteps: [],
    }
  }

  return {
    recipeId: recipe.id,
    title: recipe.title,
    status: dryRun ? 'dry-run' : 'applied',
    changesCount: 4,
    description: `Successfully simulated recipe "${recipe.title}". Transformed source patterns matching [${recipe.sourcePattern}] to [${recipe.targetPattern}].`,
    verificationSteps: [
      `1. Execute verification test suite: ${recipe.verificationCommand}`,
      '2. Validate zero AST syntax errors in target source files.',
      '3. Verify GCP service credentials (IAM Workload Identity / Service Account).',
      '4. Check that container image builds and starts in Cloud Run test sandbox.',
    ],
  }
}
