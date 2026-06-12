import http from "node:http";
import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { queueDepth, pollCommand, ackCommand } from "./postbackQueue";
import type { PollRequest, AckRequest } from "./types";
import * as staging from "./staging";
import { writeReceipt } from "./receipt";
import { dispatchToNativeChat } from "./nativeChatTarget";
import path from "node:path";

function jsonResponse(res: http.ServerResponse, obj: unknown, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

export function maybeStartCourierBridge(context: vscode.ExtensionContext, chatInterop?: any): vscode.Disposable | undefined {
  const config = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
  const enabled = config.get<boolean>("courier.enabled", false);
  if (!enabled) {
    return undefined;
  }

  const port = config.get<number>("courier.port", 37175);
  const host = "127.0.0.1";

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "", `http://${req.headers.host ?? `${host}:${port}`}`);
      if (req.method === "POST" && url.pathname === "/tiinex-courier/status") {
        const incomingConfigured = Boolean(config.get<string>("courier.incomingDirectory", ""));
        jsonResponse(res, { ok: true, enabled: true, incomingDirectoryConfigured: incomingConfigured, runtimeTarget: "native-chat", queueDepth: queueDepth() });
        return;
      }

      if (req.method === "POST" && url.pathname === "/tiinex-courier/extension/poll") {
        const bodyRes = await readJsonBody(req, 64 * 1024);
        if (!bodyRes.ok) {
          // For poll: empty body may be acceptable, but oversized/invalid must be rejected
          if (bodyRes.status === 413) {
            jsonResponse(res, { ok: false, error: bodyRes.reason }, 413);
            return;
          }
          if (bodyRes.status === 400) {
            jsonResponse(res, { ok: false, error: bodyRes.reason }, 400);
            return;
          }
        }
        const parsed: PollRequest | undefined = bodyRes.ok ? (bodyRes.value as PollRequest | undefined) : undefined;
        const chatKey = parsed?.state?.chatKey as string | undefined;
        const cmd = pollCommand(chatKey ?? null);
        if (!cmd) {
          jsonResponse(res, { ok: true, command: null });
          return;
        }
        // return the command but do not remove it until ack
        jsonResponse(res, { ok: true, command: cmd });
        return;
      }

      if (req.method === "POST" && url.pathname === "/tiinex-courier/extension/ack") {
        const bodyRes = await readJsonBody(req, 64 * 1024);
        if (!bodyRes.ok) {
          if (bodyRes.status === 413) {
            jsonResponse(res, { ok: false, error: bodyRes.reason }, 413);
            return;
          }
          if (bodyRes.status === 400) {
            jsonResponse(res, { ok: false, error: bodyRes.reason }, 400);
            return;
          }
        }
        const parsed: AckRequest | undefined = bodyRes.ok ? (bodyRes.value as AckRequest | undefined) : undefined;
        if (!parsed || !parsed.commandId) {
          jsonResponse(res, { ok: false, reason: "missing commandId" }, 400);
          return;
        }
        const okFlag = parsed.ok !== undefined ? Boolean(parsed.ok) : true;
        const acked = ackCommand(parsed.commandId, okFlag, parsed.result);
        jsonResponse(res, { ok: true, acked });
        return;
      }

      // /downloaded: handle a browser-downloaded local file path
      if (req.method === "POST" && url.pathname === "/tiinex-courier/downloaded") {
        const bodyRes = await readJsonBody(req, 64 * 1024);
        if (!bodyRes.ok) {
          if (bodyRes.status === 413) return jsonResponse(res, { ok: false, error: bodyRes.reason }, 413);
          return jsonResponse(res, { ok: false, error: bodyRes.reason }, 400);
        }
        const parsed = bodyRes.value as any || {};
        const cfg = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
        try {
          if (!parsed.filename) return jsonResponse(res, { ok: false, error: "missing filename" }, 400);
          const source = String(parsed.filename);
          try {
            await fs.access(source);
          } catch {
            return jsonResponse(res, { ok: false, error: "source file not found" }, 400);
          }
          const filename = path.basename(source);
          const fromDownloaded = true;
          const allowed = staging.extensionAllowed(filename, fromDownloaded);

          // If single markdown handoff, prefer direct downloaded-path handoff without repo staging
          const lower = filename.toLowerCase();
          if (lower.endsWith('.md') || lower.endsWith('.trace.md')) {
            const handoffContent = buildHandoffPrompt({ handoffPath: undefined, receiptPath: null, originalPath: source });

            // attempt to create native chat and attach the downloaded file when possible
            const dispatchResult = await dispatchToNativeChat(chatInterop, handoffContent, cfg, source);

            // Do not create repo staging by default for single markdown; return attachment attempt evidence
            return jsonResponse(res, { ok: true, downloaded: { originalPath: source, originalFilename: filename }, allowed, dispatchResult });
          }

          // Fallback: for other files, preserve existing staging behavior
          const incomingRoot = await staging.resolveIncomingRoot(vscode, cfg);
          const staged = await staging.copyDownloaded(incomingRoot, source, filename);

          // determine receipt path and build handoff prompt file
          const receiptPath = path.join(staged.receiptDir, 'courier-receipt.md');
          const handoffFile = path.join(staged.handoffDir, 'intake-prompt.md');
          const handoffContent = buildHandoffPrompt({ handoffPath: handoffFile, receiptPath, originalPath: staged.originalPath });
          await fs.writeFile(handoffFile, handoffContent, 'utf-8');

          const dispatchResult = await dispatchToNativeChat(chatInterop, handoffContent, cfg);

          const receiptPathWritten = await writeReceipt(staged.receiptDir, {
            receivedAt: new Date().toISOString(),
            endpoint: 'downloaded',
            sourcePageUrl: parsed.sourcePageUrl,
            chatKey: parsed.chatKey,
            originalFilename: filename,
            stagedOriginalPath: staged.originalPath,
            sha256: staged.sha,
            bytes: staged.bytes,
            mime: parsed.mime,
            warnings: allowed ? [] : ['extension not allowlisted'],
            runtimeTarget: cfg.get('courier.runtimeTarget', 'native-chat'),
            dispatchResult
          });

          return jsonResponse(res, { ok: true, staged: { base: staged.base, originalPath: staged.originalPath, sha256: staged.sha, bytes: staged.bytes }, receipt: receiptPathWritten, handoffPath: handoffFile, dispatchResult });
        } catch (err) {
          return jsonResponse(res, { ok: false, error: String(err) }, 400);
        }
      }

      // /packet-content: receive base64 content for staging
      if (req.method === "POST" && url.pathname === "/tiinex-courier/packet-content") {
        const cfg = vscode.workspace.getConfiguration("tiinex.aiVscodeTools");
        const maxPacket = cfg.get ? cfg.get('courier.maxPacketBytes', 10485760) : (cfg.courier?.maxPacketBytes || 10485760);
        const maxPacketJsonBytes = Math.ceil(maxPacket * 1.40) + 16 * 1024;
        const bodyRes = await readJsonBody(req, maxPacketJsonBytes);
        if (!bodyRes.ok) {
          if (bodyRes.status === 413) return jsonResponse(res, { ok: false, error: bodyRes.reason }, 413);
          return jsonResponse(res, { ok: false, error: bodyRes.reason }, 400);
        }
        const parsed = bodyRes.value as any || {};
        try {
          const incomingRoot = await staging.resolveIncomingRoot(vscode, cfg);
          if (!parsed.filename || !parsed.contentBase64) return jsonResponse(res, { ok: false, error: "missing filename or contentBase64" }, 400);
          const buf = Buffer.from(parsed.contentBase64, 'base64');
          if (buf.length > maxPacket) return jsonResponse(res, { ok: false, error: 'packet too large' }, 413);
          const allowed = staging.extensionAllowed(parsed.filename, false);
          const staged = await staging.stagePacket(incomingRoot, parsed.filename, parsed.contentBase64);

          // determine receipt path and build handoff prompt file
          const receiptPath = path.join(staged.receiptDir, 'courier-receipt.md');
          const handoffFile = path.join(staged.handoffDir, 'intake-prompt.md');
          const handoffContent = buildHandoffPrompt({ handoffPath: handoffFile, receiptPath, originalPath: staged.originalPath });
          await fs.writeFile(handoffFile, handoffContent, 'utf-8');

          // dispatch to native chat and await acceptance
          const dispatchResult = await dispatchToNativeChat(chatInterop, handoffContent, cfg);

          // write receipt including dispatchResult
          const receiptPathWritten = await writeReceipt(staged.receiptDir, {
            receivedAt: new Date().toISOString(),
            endpoint: 'packet-content',
            sourcePageUrl: parsed.sourcePageUrl,
            chatKey: parsed.chatKey,
            originalFilename: parsed.filename,
            stagedOriginalPath: staged.originalPath,
            sha256: staged.sha,
            bytes: staged.bytes,
            mime: parsed.mime,
            warnings: allowed ? [] : ['extension not allowlisted'],
            runtimeTarget: cfg.get('courier.runtimeTarget', 'native-chat'),
            dispatchResult
          });

          return jsonResponse(res, { ok: true, staged: { base: staged.base, originalPath: staged.originalPath, sha256: staged.sha, bytes: staged.bytes }, receipt: receiptPathWritten, handoffPath: handoffFile, dispatchResult });
        } catch (err) {
          return jsonResponse(res, { ok: false, error: String(err) }, 400);
        }
      }

      jsonResponse(res, { ok: false, error: "unknown endpoint" }, 404);
    } catch (err) {
      jsonResponse(res, { ok: false, error: String(err) }, 500);
    }
  });

  server.on("error", (err) => {
    void vscode.window.showErrorMessage(`Tiinex courier bridge server error: ${String(err)}`);
  });

  server.listen(port, host, () => {
    void vscode.window.showInformationMessage(`Tiinex courier bridge listening on http://${host}:${port}`);
  });

  const disp: vscode.Disposable = {
    dispose: () => {
      try { server.close(); } catch {}
    }
  };

  return disp;
}

type JsonBodyResult =
  | { ok: true; value: unknown | undefined }
  | { ok: false; status: 400 | 413; reason: string };

async function readJsonBody(req: http.IncomingMessage, maxBytes: number): Promise<JsonBodyResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let tooLarge = false;
    const onData = (chunk: Buffer) => {
      if (tooLarge) return;
      received += chunk.length;
      if (received > maxBytes) {
        // mark too large and stop accumulating further chunks
        tooLarge = true;
        resolve({ ok: false, status: 413, reason: `request body exceeds ${maxBytes} bytes` });
        return;
      }
      chunks.push(chunk);
    };
    req.on('data', onData);
    req.on('end', () => {
      if (tooLarge) return; // already resolved
      try {
        const txt = Buffer.concat(chunks).toString('utf8');
        if (!txt) return resolve({ ok: true, value: undefined });
        try {
          const parsed = JSON.parse(txt);
          return resolve({ ok: true, value: parsed });
        } catch (err) {
          return resolve({ ok: false, status: 400, reason: `invalid JSON body: ${String(err)}` });
        }
      } catch (err) {
        return resolve({ ok: false, status: 400, reason: `error reading body: ${String(err)}` });
      }
    });
    req.on('error', (err) => resolve({ ok: false, status: 400, reason: `request error: ${String(err)}` }));
  });
}

function buildHandoffPrompt(opts: { handoffPath?: string; receiptPath?: string | null; originalPath: string }) {
  const lines: string[] = [];
  lines.push('# Tiinex Courier Handoff Prompt', '');
  lines.push('classify as: clear / ambiguous / unsafe / too broad', '');
  lines.push('Artifact information:');
  if (opts.handoffPath) lines.push(`- handoff: ${opts.handoffPath}`);
  if (opts.receiptPath) lines.push(`- receipt: ${opts.receiptPath}`);
  lines.push(`- original: ${opts.originalPath}`, '');
  lines.push('Epistemic policy:');
  lines.push('- classify as: clear / ambiguous / unsafe / too broad');
  lines.push('- proceed without asking permission when the leaf is clear and bounded');
  lines.push('- queue a postback when blocked, complete, rejected, or clarification is needed');
  lines.push('- do not ask "should I start?" for a bounded leaf');
  lines.push('- do not commit or push unless repository changes are verified and no blocker exists', '');
  lines.push('Handoff instructions:');
  lines.push('- Use the above artifact references and the epistemic policy when deciding whether to act.');
  lines.push('- If the leaf is clear, perform the bounded action non-blocking and record results.');
  lines.push('');
  return lines.join('\n');
}
