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
  for (const k of ["receivedAt", "endpoint", "sourcePageUrl", "chatKey", "originalFilename", "stagedOriginalPath", "sha256", "bytes", "mime", "warnings", "runtimeTarget", "dispatchResult"]) {
    const v = d[k];
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`- ${k}:`);
      for (const item of v) lines.push(`  - ${String(item)}`);
    } else {
      lines.push(`- ${k}: ${String(v)}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
