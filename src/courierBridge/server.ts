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
        let body = "";
        for await (const chunk of req) body += chunk;
        let parsed: PollRequest | undefined = undefined;
        try { parsed = body ? JSON.parse(body) : undefined; } catch {}
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
        let body = "";
        for await (const chunk of req) body += chunk;
        let parsed: AckRequest | undefined = undefined;
        try { parsed = body ? JSON.parse(body) : undefined; } catch {}
        if (!parsed || !parsed.commandId) {
          jsonResponse(res, { ok: false, reason: "missing commandId" }, 400);
          return;
        }
        const ok = ackCommand(parsed.commandId);
        jsonResponse(res, { ok: true, acked: ok });
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
