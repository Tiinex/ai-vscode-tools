import http from "node:http";
import { promises as fs } from "node:fs";
import * as vscode from "vscode";
import { queueDepth, pollCommand, ackCommand } from "./postbackQueue";
import type { PollRequest, AckRequest } from "./types";

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

      // For other courier endpoints return 501 for now
      if (req.method === "POST" && (url.pathname === "/tiinex-courier/downloaded" || url.pathname === "/tiinex-courier/packet-content")) {
        jsonResponse(res, { ok: false, error: "Not implemented" }, 501);
        return;
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
