export type AIErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'free_limit'
  | 'busy'
  | 'auth'
  | 'quota'
  | 'model_unavailable'
  | 'bad_request'
  | 'upstream'
  | 'invalid_response';

/** Provider-independent AI error. Never carries prompts, replies or keys. */
export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly status?: number,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}
