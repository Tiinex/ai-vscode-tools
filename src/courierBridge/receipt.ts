import { promises as fs } from "node:fs";
import path from "node:path";

export async function writeReceipt(receiptDir: string, data: Record<string, any>) {
  const md = buildReceiptMd(data);
  const file = path.join(receiptDir, "courier-receipt.md");
  await fs.writeFile(file, md, "utf-8");
  return file;
}

function buildReceiptMd(d: Record<string, any>) {
  const lines: string[] = [];
  lines.push("# Tiinex Courier Receipt", "");
  function renderValue(v: any) {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map((x) => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(', ');
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  for (const k of ["receivedAt", "endpoint", "sourcePageUrl", "chatKey", "originalFilename", "stagedOriginalPath", "sha256", "bytes", "mime", "warnings", "runtimeTarget", "dispatchResult"]) {
    const v = d[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`- ${k}:`);
      for (const item of v) lines.push(`  - ${renderValue(item)}`);
    } else {
      lines.push(`- ${k}: ${renderValue(v)}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
