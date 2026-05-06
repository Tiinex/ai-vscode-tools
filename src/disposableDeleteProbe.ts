export interface DisposableDeleteProbeSpec {
  anchor: string;
  prompt: string;
}

export interface DisposableDeleteProbeSpecRequest {
  anchor?: string;
  prompt?: string;
}

export function buildDisposableDeleteProbeSpec(
  request?: DisposableDeleteProbeSpecRequest,
  now = new Date()
): DisposableDeleteProbeSpec {
  const timestamp = [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
    now.getHours().toString().padStart(2, "0"),
    now.getMinutes().toString().padStart(2, "0"),
    now.getSeconds().toString().padStart(2, "0")
  ].join("_");
  const requestedAnchor = request?.anchor?.trim();
  const anchor = requestedAnchor && requestedAnchor.length > 0
    ? requestedAnchor
    : `AA_DELETE_PROBE_${timestamp}`;
  const requestedPrompt = request?.prompt?.trim();
  const basePrompt = requestedPrompt && requestedPrompt.length > 0
    ? requestedPrompt
    : "Please answer with the single word READY.";
  return {
    anchor,
    prompt: basePrompt.includes(anchor) ? basePrompt : `${anchor} ${basePrompt}`
  };
}