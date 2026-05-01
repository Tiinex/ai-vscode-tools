export interface CopilotCliLatestTurnSummary {
  interactionId?: string;
  userMessage?: string;
  userTimestamp?: string;
  assistantMessage?: string;
  assistantTimestamp?: string;
  toolRequestNames: string[];
  toolExecutionNames: string[];
  toolExecutionCount: number;
  completed: boolean;
  completedAt?: string;
  eventCount: number;
}

export function summarizeCopilotCliEventStream(raw: string): CopilotCliLatestTurnSummary | undefined {
  const lines = raw.split(/\r?\n/);
  let eventCount = 0;
  let latestTurn: CopilotCliLatestTurnSummary | undefined;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    eventCount += 1;
    const type = typeof parsed.type === "string" ? parsed.type : undefined;
    const data = parsed.data && typeof parsed.data === "object" ? parsed.data as Record<string, unknown> : {};
    const timestamp = typeof parsed.timestamp === "string" ? parsed.timestamp : undefined;

    if (type === "user.message") {
      latestTurn = {
        interactionId: typeof data.interactionId === "string" ? data.interactionId : undefined,
        userMessage: previewCopilotCliText(data.content),
        userTimestamp: timestamp,
        assistantMessage: undefined,
        assistantTimestamp: undefined,
        toolRequestNames: [],
        toolExecutionNames: [],
        toolExecutionCount: 0,
        completed: false,
        completedAt: undefined,
        eventCount
      };
      continue;
    }

    if (!latestTurn) {
      continue;
    }

    if (type === "assistant.message") {
      const assistantMessage = previewCopilotCliText(data.content);
      if (assistantMessage) {
        latestTurn.assistantMessage = assistantMessage;
      }
      latestTurn.assistantTimestamp = timestamp;
      if (Array.isArray(data.toolRequests)) {
        for (const request of data.toolRequests) {
          if (!request || typeof request !== "object") {
            continue;
          }
          const name = (request as Record<string, unknown>).name;
          if (typeof name === "string" && name.trim()) {
            pushUniqueString(latestTurn.toolRequestNames, name.trim());
          }
        }
      }
      latestTurn.eventCount = eventCount;
      continue;
    }

    if (type === "tool.execution_start") {
      const toolName = typeof data.toolName === "string" ? data.toolName.trim() : "";
      if (toolName) {
        pushUniqueString(latestTurn.toolExecutionNames, toolName);
      }
      latestTurn.toolExecutionCount += 1;
      latestTurn.eventCount = eventCount;
      continue;
    }

    if (type === "assistant.turn_end") {
      latestTurn.completed = true;
      latestTurn.completedAt = timestamp;
      latestTurn.eventCount = eventCount;
    }
  }

  if (!latestTurn) {
    return undefined;
  }
  latestTurn.eventCount = eventCount;
  return latestTurn;
}

export function renderCopilotCliLatestTurnLines(latestTurn?: CopilotCliLatestTurnSummary): string[] {
  if (!latestTurn) {
    return ["- Latest turn summary: unavailable from the current events.jsonl payload."];
  }
  return [
    `- Latest user message: ${latestTurn.userMessage ?? "-"}`,
    `- Latest assistant message: ${latestTurn.assistantMessage ?? "-"}`,
    `- Tool requests declared: ${latestTurn.toolRequestNames.length > 0 ? latestTurn.toolRequestNames.join(", ") : "-"}`,
    `- Tool executions observed: ${latestTurn.toolExecutionCount > 0 ? `${latestTurn.toolExecutionCount} (${latestTurn.toolExecutionNames.join(", ") || "unnamed"})` : "-"}`,
    `- Turn status: ${latestTurn.completed ? "completed" : "in-progress or no turn-end persisted"}`,
    latestTurn.completedAt ? `- Turn completed at: ${latestTurn.completedAt}` : undefined,
    latestTurn.interactionId ? `- Interaction ID: ${latestTurn.interactionId}` : undefined,
    `- Events scanned to derive latest turn: ${latestTurn.eventCount}`,
    "- Note: this latest-turn summary is derived from persisted events.jsonl rows and can lag behind the live Copilot CLI UI."
  ].filter((line): line is string => Boolean(line));
}

function pushUniqueString(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

function previewCopilotCliText(value: unknown, maxLength = 280): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}