export type ModelRef = {
  providerID: string
  id: string
}

export type Session = {
  id: string
  [key: string]: unknown
}

export type ConnectOptions = {
  /** OpenCode service URL; use a private Docker network or TLS-protected route. */
  baseUrl: string
  /** OpenCode server password. Keep it in a secret store, never in client code. */
  password: string
  /** Defaults to OpenCode's HTTP Basic username. */
  username?: string
}

export type SessionClient = {
  info(): Promise<Record<string, unknown>>
  listModels(options?: { directory?: string }): Promise<Array<Record<string, unknown>>>
  createSession(options: {
    /** Absolute directory path as seen by the OpenCode server. */
    directory: string
    /** Explicit selection; this SDK never silently falls back to another model. */
    model: ModelRef
    title?: string
    /** Defaults to denying OpenCode tools for this session. */
    denyTools?: boolean
  }): Promise<Session>
  prompt(options: {
    sessionID: string
    text: string
    /** Wait for the OpenCode execution to finish before reading messages. Defaults true. */
    wait?: boolean
  }): Promise<{ sessionID: string; text: string }>
  interrupt(sessionID: string): Promise<unknown>
}

export declare function basicAuthorization(password: string, username?: string): string
export declare function createSessionClient(client: object): SessionClient
export declare function connectOpenCode(options: ConnectOptions): SessionClient
export declare function connectLocalOpenCode(): Promise<SessionClient>
