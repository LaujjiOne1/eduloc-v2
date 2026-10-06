export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushProvider {
  sendToTokens(tokens: string[], message: PushMessage): Promise<void>;
}

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');
