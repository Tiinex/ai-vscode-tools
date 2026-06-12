// Minimal staging stub for first vertical slice. Real staging and zip extraction
// are intentionally left unimplemented in this leaf.

export async function ensureStagingRoot(incomingDirectory: string | undefined): Promise<string> {
  if (!incomingDirectory) {
    throw new Error("incomingDirectory not configured");
  }
  return incomingDirectory;
}
