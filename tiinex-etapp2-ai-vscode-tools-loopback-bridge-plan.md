# Tiinex Etapp 2 — ai-vscode-tools loopback bridge and epistemic courier handoff

## Purpose

Implement the VS Code-side loopback bridge for the already-verified Tiinex Chrome Courier extension.

The goal is not to micromanage the VS Code agent. The goal is to create a respectful handoff loop:

1. Cloud ChatGPT produces downloadable artifacts.
2. Chrome Courier downloads and hands off artifacts to VS Code over loopback.
3. `ai-vscode-tools` stages the artifacts, creates receipt evidence, and opens/sends a native VS Code live chat.
4. The VS Code target agent reads the handoff and decides:
   - proceed if clear
   - ask for clarification if ambiguous
   - reject/stop if unsafe
5. Only the VS Code target agent should produce the postback message to Cloud ChatGPT, via a bounded tool that queues a Chrome Courier postback command.

Cloud ChatGPT should continue to deliver plans as artifacts, not as direct live-chat messages.

---

## Current Chrome Courier contract

Chrome Courier v0.2.3 is verified for:

- per-chat Tiinex activation
- Tiinex chip
- GitHub activation
- fresh artifact download detection
- download path handoff
- blob/data content handoff
- debugger-based postback submit
- visible postback format: `prefix + message + links`
- hidden `commandId` transport metadata

Chrome cannot expose an inbound HTTP server. Therefore the VS Code bridge must be the local HTTP server, and Chrome must poll it.

Chrome expects these loopback endpoints on localhost only:

```text
POST /tiinex-courier/status
POST /tiinex-courier/downloaded
POST /tiinex-courier/packet-content
POST /tiinex-courier/extension/poll
POST /tiinex-courier/extension/ack
```

Chrome polls:

```text
POST http://127.0.0.1:37175/tiinex-courier/extension/poll
```

The bridge returns either:

```json
{ "ok": true, "command": null }
```

or one queued postback command:

```json
{
  "ok": true,
  "command": {
    "type": "postback",
    "commandId": "uuid-or-counter",
    "prefix": "Sigma",
    "message": "Kort mänskligt meddelande till Cloud ChatGPT.",
    "links": ["https://github.com/Tiinex/ai-vscode-tools"],
    "expiresAt": "2026-06-12T12:00:00.000Z"
  }
}
```

Chrome always executes postback commands as:

```text
verify Tiinex active
-> enable GitHub app
-> replace composer with debugger
-> submit with debugger
-> POST /extension/ack
```

There is no `mode` field anymore.

---

## Repo grounding

Use these existing `ai-vscode-tools` surfaces instead of inventing a second chat system:

- `src/extension.ts`
  - activation entrypoint is `activate(context)`
  - creates `chatInterop` through `registerChatInterop`
  - calls `registerLanguageModelTools(context, adapter, chatInterop)`
  - calls `registerCommands(context, adapter, tree, chatInterop)`

- `src/chatInterop/types.ts`
  - `CreateChatRequest`
  - `SendChatMessageRequest`
  - `ChatCommandResult`
  - `ChatInteropApi`
  - `ChatInteropApi.createChat`
  - `ChatInteropApi.sendMessage`
  - `ChatInteropApi.sendFocusedMessage`

- `src/chatInterop/service.ts`
  - `ChatInteropService.createChat`
  - `ChatInteropService.sendMessage`
  - `ChatInteropService.sendFocusedMessage`
  - existing mutex/lease behavior must be respected

- `src/languageModelTools.ts`
  - existing LM tool registration pattern
  - existing `LocalChatTool`/`LiveChatTool` serializes host-bound invocations with `liveChatToolMutex`
  - existing `create_live_agent_chat`
  - existing `send_message_to_live_agent_chat`

- `src/chatInterop/promptDispatch.ts`
  - existing prompt-file dispatch exists for agentName-bound creation.
  - Do not invent an attachment system before checking whether the existing prompt-file route is sufficient.

---

## Design boundary

### Chrome Courier owns

- ChatGPT DOM integration
- user activation state
- fresh artifact detection
- download path/content handoff
- postback command execution
- debugger submit

### `ai-vscode-tools` owns

- loopback server
- required incoming directory
- artifact staging
- zip validation/extraction
- receipt trace creation
- queueing postback commands
- opening/sending native VS Code live chat through existing `ChatInteropApi`
- registering a target-agent tool for postback queueing

### Target VS Code agent owns

- epistemic review of handoff artifact
- deciding whether to proceed
- deciding whether to request clarification
- producing postback text when needed

### Not Etapp 2

- ai-provenance runtime target
- full custom AI runtime provider logic
- browser-side settings
- public network server
- executing downloaded packet contents directly

---

## Required settings

Add settings under `tiinex.aiVscodeTools.*`:

```json
{
  "tiinex.aiVscodeTools.courier.enabled": false,
  "tiinex.aiVscodeTools.courier.port": 37175,
  "tiinex.aiVscodeTools.courier.incomingDirectory": "",
  "tiinex.aiVscodeTools.courier.extractZip": true,
  "tiinex.aiVscodeTools.courier.createTraceReceipt": true,
  "tiinex.aiVscodeTools.courier.runtimeTarget": "native-chat",
  "tiinex.aiVscodeTools.courier.postbackPrefix": "Sigma",
  "tiinex.aiVscodeTools.courier.defaultAgentName": "",
  "tiinex.aiVscodeTools.courier.defaultModelId": "",
  "tiinex.aiVscodeTools.courier.defaultModelVendor": "",
  "tiinex.aiVscodeTools.courier.workspaceFolderName": "",
  "tiinex.aiVscodeTools.courier.artifactRootRelativePath": ".tiinex/courier"
}
```

Rules:

- Server starts only when `courier.enabled === true`.
- Server listens only on `127.0.0.1`.
- `incomingDirectory` is required for M0.
- If `incomingDirectory` is empty, reject `/downloaded` and `/packet-content` with a clear error.
- `workspaceFolderName` is optional. If multiple workspace roots exist and no explicit `incomingDirectory` or `workspaceFolderName` is configured, reject instead of guessing.

---

## Multi-workspace artifact policy

Do not guess silently in a multi-root workspace.

Resolution order:

1. explicit `courier.incomingDirectory`
2. workspace folder matching `courier.workspaceFolderName`
3. single workspace folder + `courier.artifactRootRelativePath`
4. reject with configuration error

Staging layout:

```text
<incomingRoot>/
  incoming/
    <yyyyMMdd-HHmmss>-<shortHash>-<sourceName>/
      original/
      extracted/
      receipt/
      handoff/
```

If the user wants artifacts committed, the configured `incomingDirectory` should point inside the intended repository. The bridge should not decide what gets committed; it should only stage deterministic files and make them easy to review.

Recommended generated files:

```text
original/<downloaded-file>
extracted/<safe extracted files>
receipt/courier-receipt.md
handoff/intake-prompt.md
handoff/postback-command-schema.json
```

---

## Endpoint behavior

### `POST /tiinex-courier/status`

Return:

```json
{
  "ok": true,
  "enabled": true,
  "incomingDirectoryConfigured": true,
  "runtimeTarget": "native-chat",
  "queueDepth": 0
}
```

If disabled, still return 200 with:

```json
{ "ok": true, "enabled": false }
```

### `POST /tiinex-courier/downloaded`

Input from Chrome:

```json
{
  "source": "chrome-downloads",
  "pageUrl": "https://chatgpt.com/...",
  "chatKey": "...",
  "downloadId": 123,
  "filename": "C:\\Users\\Q\\Downloads\\artifact.md",
  "mime": "text/markdown",
  "fileSize": 1234,
  "candidate": {},
  "completedAt": "..."
}
```

Actions:

1. Verify enabled.
2. Verify loopback/local request.
3. Verify incoming directory configured.
4. Verify source file exists.
5. Copy to deterministic staging folder.
6. Compute sha256.
7. If zip and `extractZip`, safely extract.
8. Create receipt if enabled.
9. Create handoff prompt.
10. Dispatch to runtime target.
11. Return bounded JSON with staging path and dispatch result.

### `POST /tiinex-courier/packet-content`

Input from Chrome:

```json
{
  "source": "chatgpt-content-script",
  "pageUrl": "https://chatgpt.com/...",
  "chatKey": "...",
  "filename": "artifact.md",
  "mime": "text/markdown",
  "contentBase64": "...",
  "candidate": {}
}
```

Same behavior as `/downloaded`, but write base64 content first.

### `POST /tiinex-courier/extension/poll`

Input from Chrome:

```json
{
  "source": "chrome-extension",
  "state": {
    "active": true,
    "chatKey": "...",
    "pageUrl": "https://chatgpt.com/..."
  },
  "requestedAt": "..."
}
```

Behavior:

- if no command queued for that chat/source, return `{ "ok": true, "command": null }`
- if command exists and not expired, return it once
- do not mark final success until `/extension/ack`
- if ack is missing, retry is allowed only while command is not expired

### `POST /tiinex-courier/extension/ack`

Input:

```json
{
  "commandId": "uuid-or-counter",
  "ok": true,
  "result": {},
  "ackedAt": "..."
}
```

Behavior:

- mark command as `acked` if known
- persist ack status in receipt/queue state
- return bounded JSON

---

## Add LM tool for target-agent postback

Add a new language model tool:

```text
queue_tiinex_courier_postback
```

Tool purpose:

The VS Code target agent uses this tool when it wants to answer Cloud ChatGPT. The bridge queues a Chrome Courier postback command. Chrome later polls and submits it.

Tool input:

```json
{
  "prefix": "Sigma",
  "message": "Jag behöver ett förtydligande innan jag fortsätter...",
  "links": ["https://github.com/Tiinex/ai-vscode-tools"],
  "expiresInSeconds": 300
}
```

Tool behavior:

- requires courier server enabled
- validates non-empty message
- uses `postbackPrefix` setting if prefix omitted
- creates `commandId`
- queues a `postback` command for Chrome
- returns a concise confirmation with `commandId`, `expiresAt`, and queue depth

This is the important epistemic boundary: the target agent, not the planner, decides if a postback is warranted.

---

## Native chat dispatch behavior

For Etapp 2, implement only:

```text
runtimeTarget = native-chat
```

Use `ChatInteropApi.createChat` first.

Build a handoff prompt that gives the target agent autonomy:

```text
You are the VS Code target agent for a Tiinex courier handoff.

Cloud ChatGPT produced one or more artifacts. They have been staged locally.

Read the staged handoff files first:
- <handoff/intake-prompt.md>
- <receipt/courier-receipt.md>
- <original/extracted paths>

Your first responsibility is epistemic review, not blind execution.

You may:
1. proceed if the handoff is clear and safe
2. ask Cloud ChatGPT for clarification by using queue_tiinex_courier_postback
3. stop if the handoff is unsafe or underspecified

Do not assume the planner is correct just because a markdown artifact exists.
Do not broaden the task beyond the artifact.
If you proceed, keep changes bounded and report evidence.
```

Request to `chatInterop.createChat`:

```ts
await chatInterop.createChat({
  prompt: handoffPrompt,
  agentName: config.defaultAgentName || undefined,
  modelSelector: config.defaultModelId
    ? { id: config.defaultModelId, vendor: config.defaultModelVendor || undefined }
    : undefined,
  blockOnResponse: false,
  waitForPersisted: false,
  requireSelectionEvidence: false
});
```

Do not block on response in M0. The target agent can later queue a postback through the LM tool.

---

## File validation

Allowed default extensions:

```text
.md
.trace.md
.json
.txt
.diff
.patch
.zip
```

Blocked default executable/script-like extensions:

```text
.exe
.dll
.ps1
.bat
.cmd
.sh
.js
.mjs
.cjs
.node
.env
```

Zip extraction rules:

- reject absolute paths
- reject `..` traversal
- reject symlinks/junction-like entries when detectable
- max zip input size
- max total extracted size
- max file count
- do not execute anything from the zip

---

## Receipt shape

Create `receipt/courier-receipt.md`.

It is not an execution trace. It is a courier receipt.

Include:

```text
# Tiinex Courier Receipt

- receivedAt
- sourcePageUrl
- chatKey
- originalFilename
- sha256
- bytes
- storedPath
- extractedPaths
- runtimeTarget
- dispatchResult
- queuedPostbacks
- warnings
- limits
```

---

## Implementation files

Create:

```text
src/courierBridge/types.ts
src/courierBridge/config.ts
src/courierBridge/server.ts
src/courierBridge/staging.ts
src/courierBridge/zip.ts
src/courierBridge/receipt.ts
src/courierBridge/postbackQueue.ts
src/courierBridge/nativeChatTarget.ts
```

Hook from `src/extension.ts` after `chatInterop` is created:

```ts
const courierBridge = maybeStartCourierBridge(context, chatInterop);
if (courierBridge) {
  context.subscriptions.push(courierBridge);
}
```

Register the new LM tool in `src/languageModelTools.ts` or a small dedicated courier tool module imported from there.

---

## Tests

Add focused tests without live VS Code network dependency where possible.

Required tests:

- config disabled returns disabled status and does not dispatch
- missing incoming directory rejects `/downloaded`
- downloaded path copies file into staging folder
- packet-content writes base64 file into staging folder
- zip traversal is rejected
- receipt is written
- native-chat target calls mocked `ChatInteropApi.createChat`
- poll returns null when queue empty
- queue postback tool creates command
- poll returns queued command
- ack marks command acked
- same command is not returned again after ack
- expired command is not returned

Run:

```bash
npm test
npm run package:vsix
```

---

## Definition of Done

- [ ] Extension settings added under `tiinex.aiVscodeTools.courier.*`
- [ ] Loopback server starts only when enabled
- [ ] Server binds only to `127.0.0.1`
- [ ] `/status` implemented
- [ ] `/downloaded` implemented
- [ ] `/packet-content` implemented
- [ ] `/extension/poll` implemented
- [ ] `/extension/ack` implemented
- [ ] Incoming directory resolution is deterministic and rejects ambiguous multi-root cases
- [ ] Safe staging folder created per artifact
- [ ] Zip extraction is safe and bounded
- [ ] Courier receipt is written
- [ ] Native-chat dispatch uses existing `ChatInteropApi.createChat`
- [ ] Handoff prompt preserves target agent epistemic autonomy
- [ ] `queue_tiinex_courier_postback` LM tool implemented
- [ ] Postback command contains only `prefix`, `message`, `links`, and transport metadata
- [ ] `commandId` is never rendered into visible ChatGPT text
- [ ] Tests pass
- [ ] VSIX packages

---

## Hard constraints

Do not:

- invent a separate VS Code chat transport
- bypass existing `ChatInteropApi`
- make the server public
- execute downloaded contents
- make the bridge depend on `ai-provenance`
- force the target agent to execute without an epistemic review step
- render role/model/job id into the Cloud ChatGPT postback
- silently choose a workspace root when ambiguous
