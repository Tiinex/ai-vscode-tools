import path from "node:path";
import { promises as fs } from "node:fs";
import {
  auditRuntimeAgentArtifactFile,
  isAllowedCompanionArtifactPath,
  isCompanionArtifactPath,
  isRuntimeAgentArtifactPath
} from "./runtimeAgentArtifactStructure";

export type ProcessVerdict = "PASS" | "FAIL";
export type CompanionDecision = "not-relevant" | "parent-proof-sufficient" | "exception-approved";
export type ReleaseState = "READY" | "DEGRADED" | "BLOCKED";

export interface AgentArchitectEvidencePackage {
  target_name?: string;
  stage_sequence?: string[];
  provenance?: {
    exercised_entrypoint?: string;
    resolved_target?: string;
    verification_artifacts?: string[];
  };
  lifecycle?: {
    target_resolution?: { status?: "PASS" | "FAIL"; artifact?: string };
    scope_resolution?: { status?: "PASS" | "FAIL"; artifact?: string };
    classification?: { status?: "PASS" | "FAIL"; value?: string; artifact?: string };
  };
  mutation?: {
    claimed?: boolean;
    changed_files?: string[];
    read_after_write?: { status?: "PASS" | "FAIL"; artifact?: string };
  };
  companion_decision_record?: {
    companion_decision?: CompanionDecision;
    companion_target_role?: string;
    companion_exception_gap?: string;
    companion_exception_reason?: string;
    decided_after_runtime_exists?: boolean;
  };
  structure_validation?: { status?: "PASS" | "FAIL"; artifact?: string };
  behavioral_assessment?: { status?: "PASS" | "FAIL" | "INCONCLUSIVE"; artifact?: string; claims_readiness?: boolean };
  release_mapping?: { requested?: boolean; artifact?: string; release_state?: ReleaseState; reason?: string };
  regression?: {
    expectations_defined?: boolean;
    runs?: Array<{
      run_id?: string;
      variant?: string;
      artifact?: string;
    }>;
  };
}

export interface AgentArchitectProcessValidationResult {
  target_name?: string;
  process_verdict: ProcessVerdict;
  satisfied_gates: string[];
  missing_or_failed_gates: string[];
  reason: string;
  provenance: {
    exercised_entrypoint?: string;
    resolved_target?: string;
    verification_artifacts?: string[];
    evidence_package_path?: string;
  };
  companion_decision_summary?: {
    companion_decision?: CompanionDecision;
    companion_target_role?: string;
    companion_exception_gap?: string;
    companion_exception_reason?: string;
  };
}

const TARGET_PREREQUISITE_GATES = ["target_resolution", "scope_resolution", "lifecycle_classification"] as const;
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..");

export async function readAgentArchitectEvidencePackage(filePath: string): Promise<AgentArchitectEvidencePackage> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as AgentArchitectEvidencePackage;
}

export async function validateAgentArchitectProcessEvidenceFile(filePath: string): Promise<AgentArchitectProcessValidationResult> {
  const evidencePackage = await readAgentArchitectEvidencePackage(filePath);
  return validateAgentArchitectProcessEvidence(evidencePackage, filePath);
}

export function validateAgentArchitectProcessEvidence(
  evidencePackage: AgentArchitectEvidencePackage,
  evidencePackagePath?: string
): AgentArchitectProcessValidationResult {
  const satisfiedGates: string[] = [];
  const missingOrFailedGates: string[] = [];
  const stageSequence = evidencePackage.stage_sequence ?? [];

  const provenance = {
    exercised_entrypoint: evidencePackage.provenance?.exercised_entrypoint,
    resolved_target: evidencePackage.provenance?.resolved_target,
    verification_artifacts: evidencePackage.provenance?.verification_artifacts,
    evidence_package_path: evidencePackagePath ? path.resolve(evidencePackagePath) : undefined
  };

  const lifecycleChecks = [
    ["target_resolution", evidencePackage.lifecycle?.target_resolution],
    ["scope_resolution", evidencePackage.lifecycle?.scope_resolution],
    ["lifecycle_classification", evidencePackage.lifecycle?.classification]
  ] as const;
  const changedFiles = evidencePackage.mutation?.changed_files ?? [];
  const normalizedChangedFiles = changedFiles.filter((filePath): filePath is string => hasNonEmptyValue(filePath));
  const runtimeArtifactCandidates = normalizedChangedFiles.filter((filePath) => isRuntimeAgentArtifactPath(filePath));
  const changedCompanionArtifacts = normalizedChangedFiles.filter((filePath) => isCompanionArtifactPath(filePath));
  const classificationValue = evidencePackage.lifecycle?.classification?.value?.trim();

  for (const [gateName, gate] of lifecycleChecks) {
    if (gate?.status === "PASS" && gate.artifact) {
      satisfiedGates.push(gateName);
    } else {
      missingOrFailedGates.push(gateName);
    }
  }

  if (hasOrderedStages(stageSequence, TARGET_PREREQUISITE_GATES)) {
    satisfiedGates.push("gate_sequence_before_mutation");
  } else {
    missingOrFailedGates.push("gate_sequence_before_mutation");
  }

  const mutationClaimed = evidencePackage.mutation?.claimed === true;
  const createClaimed = mutationClaimed && classificationValue === "CREATE";
  if (mutationClaimed) {
    if (stageSequence.includes("mutation")) {
      satisfiedGates.push("mutation_claim_recorded");
    } else {
      missingOrFailedGates.push("mutation_claim_recorded");
    }

    const readAfterWrite = evidencePackage.mutation?.read_after_write;
    if (
      readAfterWrite?.status === "PASS"
      && readAfterWrite.artifact
      && isStageAfter(stageSequence, "read_after_write", "mutation")
    ) {
      satisfiedGates.push("read_after_write");
    } else {
      missingOrFailedGates.push("read_after_write");
    }
  }

  const companionDecision = evidencePackage.companion_decision_record;
  if (changedCompanionArtifacts.length > 0) {
    if (companionDecision?.companion_decision) {
      satisfiedGates.push("companion_decision_record_present");
    } else {
      missingOrFailedGates.push("companion_decision_record_present");
    }

    if (changedCompanionArtifacts.every((filePath) => isAllowedCompanionArtifactPath(filePath))) {
      satisfiedGates.push("companion_artifact_shape");
    } else {
      missingOrFailedGates.push("companion_artifact_shape");
    }
  }

  if (companionDecision?.companion_decision) {
    if (companionDecision.decided_after_runtime_exists !== false) {
      satisfiedGates.push("companion_decision_timing");
    } else {
      missingOrFailedGates.push("companion_decision_timing");
    }

    if (companionDecision.companion_decision === "exception-approved") {
      if (
        hasNonEmptyValue(companionDecision.companion_target_role)
        && hasNonEmptyValue(companionDecision.companion_exception_gap)
        && hasNonEmptyValue(companionDecision.companion_exception_reason)
      ) {
        satisfiedGates.push("companion_decision_fields");
      } else {
        missingOrFailedGates.push("companion_decision_fields");
      }
    } else {
      satisfiedGates.push("companion_decision_fields");
    }
  }

  const structureValidation = evidencePackage.structure_validation;
  const behavioralAssessment = evidencePackage.behavioral_assessment;
  const releaseMapping = evidencePackage.release_mapping;
  const releaseMappingRequested = releaseMapping?.requested === true;
  const strongerClaimsPresent = Boolean(behavioralAssessment || releaseMappingRequested);
  const behavioralAssessmentRecorded = Boolean(
    behavioralAssessment?.status
    && behavioralAssessment.artifact
    && stageSequence.includes("behavioral_assessment")
    && (!mutationClaimed || isStageAfter(stageSequence, "behavioral_assessment", "structure_validation"))
  );
  const structureValidationRecorded = Boolean(
    structureValidation?.status === "PASS"
    && structureValidation.artifact
    && stageSequence.includes("structure_validation")
    && (!mutationClaimed || isStageAfter(stageSequence, "structure_validation", "mutation"))
  );

  if (createClaimed) {
    if (structureValidationRecorded) {
      satisfiedGates.push("create_structure_validation");
    } else {
      missingOrFailedGates.push("create_structure_validation");
    }

    // A CREATE package only satisfies the runtime artifact contract gate when
    // it preserves a valid artifact for the current supported workspace
    // runtime-agent mechanism.
    const runtimeArtifactPath = resolveRuntimeArtifactPath(runtimeArtifactCandidates, provenance.resolved_target);
    if (runtimeArtifactPath) {
      try {
        const artifactAudit = auditRuntimeAgentArtifactFile(runtimeArtifactPath);
        if (artifactAudit.structureVerdict === "PASS") {
          satisfiedGates.push("runtime_artifact_contract");
        } else {
          missingOrFailedGates.push("runtime_artifact_contract");
        }

        if (artifactAudit.supportEvidenceMarkers.length === 0) {
          satisfiedGates.push("runtime_support_boundary");
        } else {
          missingOrFailedGates.push("runtime_support_boundary");
        }
      } catch {
        missingOrFailedGates.push("runtime_artifact_contract");
        missingOrFailedGates.push("runtime_support_boundary");
      }
    } else {
      missingOrFailedGates.push("runtime_artifact_contract");
      missingOrFailedGates.push("runtime_support_boundary");
    }
  }

  if (releaseMappingRequested) {
    if (behavioralAssessmentRecorded) {
      satisfiedGates.push("behavioral_assessment_for_release_mapping");
    } else {
      missingOrFailedGates.push("behavioral_assessment_for_release_mapping");
    }

    if (
      hasNonEmptyValue(releaseMapping?.artifact)
      && isReleaseState(releaseMapping?.release_state)
      && isStageAfter(stageSequence, "release_mapping", "behavioral_assessment")
    ) {
      satisfiedGates.push("release_mapping_result");
    } else {
      missingOrFailedGates.push("release_mapping_result");
    }
  }

  if (strongerClaimsPresent) {
    if (
      structureValidationRecorded
      && (!behavioralAssessment || isStageAfter(stageSequence, "behavioral_assessment", "structure_validation"))
      && (!releaseMappingRequested || isStageAfter(stageSequence, "release_mapping", "structure_validation"))
    ) {
      satisfiedGates.push("structure_before_behavioral_or_release");
    } else {
      missingOrFailedGates.push("structure_before_behavioral_or_release");
    }
  }

  const readinessClaimed = behavioralAssessment?.claims_readiness === true || releaseMapping?.release_state === "READY";
  if (readinessClaimed) {
    const runs = evidencePackage.regression?.runs ?? [];
    const distinctVariants = new Set(runs.map((run) => run.variant?.trim()).filter((value): value is string => Boolean(value)));
    if (evidencePackage.regression?.expectations_defined === true && distinctVariants.size >= 2) {
      satisfiedGates.push("repeated_validation");
    } else {
      missingOrFailedGates.push("repeated_validation");
    }
  }

  if (
    hasNonEmptyValue(provenance.exercised_entrypoint)
    && hasNonEmptyValue(provenance.resolved_target ?? evidencePackage.target_name)
    && Array.isArray(provenance.verification_artifacts)
    && provenance.verification_artifacts.length > 0
  ) {
    satisfiedGates.push("provenance");
  } else {
    missingOrFailedGates.push("provenance");
  }

  const processVerdict: ProcessVerdict = missingOrFailedGates.length === 0 ? "PASS" : "FAIL";
  const reason = processVerdict === "PASS"
    ? "All required process gates were preserved in order for the current evidence package."
    : `Missing or failed process gates: ${missingOrFailedGates.join(", ")}`;

  return {
    target_name: evidencePackage.target_name,
    process_verdict: processVerdict,
    satisfied_gates: dedupe(satisfiedGates),
    missing_or_failed_gates: dedupe(missingOrFailedGates),
    reason,
    provenance,
    companion_decision_summary: companionDecision
      ? {
          companion_decision: companionDecision.companion_decision,
          companion_target_role: companionDecision.companion_target_role,
          companion_exception_gap: companionDecision.companion_exception_gap,
          companion_exception_reason: companionDecision.companion_exception_reason
        }
      : undefined
  };
}

function resolveRuntimeArtifactPath(runtimeArtifactCandidates: string[], resolvedTarget?: string): string | undefined {
  const candidate = runtimeArtifactCandidates[0] ?? (resolvedTarget && isRuntimeAgentArtifactPath(resolvedTarget) ? resolvedTarget : undefined);
  if (!candidate) {
    return undefined;
  }

  return path.isAbsolute(candidate) ? candidate : path.resolve(WORKSPACE_ROOT, candidate);
}

function hasOrderedStages(stageSequence: string[], orderedStages: readonly string[]): boolean {
  let previousIndex = -1;
  for (const gate of orderedStages) {
    const currentIndex = stageSequence.indexOf(gate);
    if (currentIndex === -1 || currentIndex <= previousIndex) {
      return false;
    }
    previousIndex = currentIndex;
  }
  return true;
}

function isStageAfter(stageSequence: string[], stageName: string, previousStageName: string): boolean {
  const stageIndex = stageSequence.indexOf(stageName);
  const previousStageIndex = stageSequence.indexOf(previousStageName);
  return stageIndex !== -1 && previousStageIndex !== -1 && stageIndex > previousStageIndex;
}

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isReleaseState(value: string | undefined): value is ReleaseState {
  return value === "READY" || value === "DEGRADED" || value === "BLOCKED";
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}