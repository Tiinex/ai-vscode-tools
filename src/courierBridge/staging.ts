import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as vscode from "vscode";

const allowedExtensions = new Set([".md", ".trace.md", ".json", ".txt", ".diff", ".patch", ".zip"]);

function safeFileName(name: string) {
  const base = path.basename(name).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200);
  return base || "artifact.bin";
}

function shortNow() {
  const d = new Date();
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}${mm}${dd}-${hh}${mi}${ss}`;
}

export async function resolveIncomingRoot(vscodeApi: typeof vscode, config: any): Promise<string> {
  const cfg = config ?? vscodeApi.workspace.getConfiguration("tiinex.aiVscodeTools");
  const incoming = cfg.get ? cfg.get("courier.incomingDirectory", "") : cfg.courier?.incomingDirectory || "";
  if (incoming) return path.resolve(String(incoming));

  const artifactRootRelativePath = cfg.get ? cfg.get("courier.artifactRootRelativePath", ".tiinex/courier") : cfg.courier?.artifactRootRelativePath || ".tiinex/courier";
  const wsFolders = (vscodeApi.workspace && (vscodeApi.workspace.workspaceFolders || [])) || [];
  if (wsFolders.length === 1) {
    const wf = typeof wsFolders[0] === 'string' ? wsFolders[0] : (wsFolders[0].uri && (wsFolders[0].uri.fsPath || wsFolders[0].uri.path)) || undefined;
    if (!wf) throw new Error("workspace folder path missing");
    return path.join(wf, artifactRootRelativePath);
  }

  throw new Error("cannot resolve incoming directory: set 'tiinex.aiVscodeTools.courier.incomingDirectory' or open a single-folder workspace");
}

export async function makeStagingForBuffer(incomingRoot: string, filename: string, buf: Buffer) {
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const shortHash = sha.slice(0, 8);
  const safe = safeFileName(filename);
  const folder = `${shortNow()}-${shortHash}-${safe.replace(/\./g, "_")}`;
  const base = path.join(incomingRoot, "incoming", folder);
  const originalDir = path.join(base, "original");
  const receiptDir = path.join(base, "receipt");
  const handoffDir = path.join(base, "handoff");
  await fs.mkdir(originalDir, { recursive: true });
  await fs.mkdir(receiptDir, { recursive: true });
  await fs.mkdir(handoffDir, { recursive: true });
  const originalPath = path.join(originalDir, safe);
  await fs.writeFile(originalPath, buf);
  return { base, originalPath, receiptDir, handoffDir, sha, bytes: buf.length };
}

export function extensionAllowed(filename: string, fromDownloaded = false) {
  const ext = path.extname(filename).toLowerCase();
  if (!ext) return false;
  if (allowedExtensions.has(ext)) return true;
  // allow unknown for downloaded but warn elsewhere
  return fromDownloaded;
}

export async function copyDownloaded(incomingRoot: string, sourcePath: string, filename: string) {
  const buf = await fs.readFile(sourcePath);
  return await makeStagingForBuffer(incomingRoot, filename || path.basename(sourcePath), buf);
}

export async function stagePacket(incomingRoot: string, filename: string, contentBase64: string) {
  const buf = Buffer.from(contentBase64, 'base64');
  return await makeStagingForBuffer(incomingRoot, filename, buf);
}
// Minimal staging stub for first vertical slice. Real staging and zip extraction
// are intentionally left unimplemented in this leaf.

export async function ensureStagingRoot(incomingDirectory: string | undefined): Promise<string> {
  if (!incomingDirectory) {
    throw new Error("incomingDirectory not configured");
  }
  return incomingDirectory;
}
