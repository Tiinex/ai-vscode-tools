export interface PostbackCommand {
  type: "postback";
  commandId: string;
  prefix: string;
  message: string;
  links?: string[];
  expiresAt: string; // ISO
  chatKey?: string | null;
  acked?: boolean;
  ackedAt?: string | null;
  // last ack metadata (ok may be false for failed delivery)
  lastAck?: {
    ok: boolean;
    result?: Record<string, unknown>;
    at: string;
  } | null;
}

export interface PollRequest {
  source?: string;
  state?: Record<string, unknown>;
  requestedAt?: string;
}

export interface AckRequest {
  commandId: string;
  ok: boolean;
  result?: Record<string, unknown>;
  ackedAt?: string;
}
