/**
 * Types and configuration interfaces for the Antigravity CLI plugin.
 *
 * @module @deepseek-ai/dsh-subagent-antigravity-cli/types
 */

export interface AntigravityCliConfig {
  /**
   * Explicit path to the agentapi or agy binary.
   * If omitted, searches default locations and PATH.
   */
  binaryPath?: string
  /**
   * Default Gemini model for Antigravity agents (e.g. 'gemini-3.7-flash').
   */
  defaultModel?: string
  /**
   * Google Cloud project ID for Gemini Enterprise Agent Platform.
   */
  gcpProject?: string
  /**
   * Google Cloud location (e.g. 'global' or 'us-central1').
   */
  gcpLocation?: string
  /**
   * Custom environment variables layered on spawned processes.
   */
  env?: Record<string, string>
  /**
   * Process termination grace period in milliseconds.
   */
  disposeGraceMs?: number
}
