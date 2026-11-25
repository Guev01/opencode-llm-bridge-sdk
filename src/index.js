import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/service"

const DENY_ALL = Object.freeze([
  Object.freeze({ action: "*", resource: "*", effect: "deny" }),
])

function parseBaseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new TypeError("baseUrl must be an absolute HTTP(S) URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("baseUrl must use HTTP or HTTPS")
  }
  if (url.username || url.password) {
    throw new TypeError("Do not embed credentials in baseUrl; pass password separately")
  }
  return url.toString().replace(/\/$/, "")
}

export function basicAuthorization(password, username = "opencode") {
  if (typeof password !== "string" || password.length === 0) {
    throw new TypeError("password is required")
  }
  if (typeof username !== "string" || username.length === 0 || username.includes(":")) {
    throw new TypeError("username must be a non-empty string without ':'")
  }
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`
}

function normalizeModel(model) {
  if (!model || typeof model.providerID !== "string" || typeof model.id !== "string") {
    throw new TypeError("model must explicitly include providerID and id; no model fallback is performed")
  }
  return { providerID: model.providerID, id: model.id }
}

function unwrap(value) {
  return value?.data ?? value
}

function assistantText(messages) {
  const list = unwrap(messages)
  if (!Array.isArray(list)) return ""
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i]
    if (message?.type !== "assistant") continue
    if (message.error) {
      throw new Error(`OpenCode generation failed: ${message.error.message ?? message.error.type ?? "unknown error"}`)
    }
    const text = (message.content ?? [])
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("")
    if (text.length === 0) {
      throw new Error("OpenCode returned no assistant text; this SDK does not expose tool-call or multimodal outputs")
    }
    return text
  }
  throw new Error("OpenCode completed without an assistant message")
}

/**
 * Wrap the official OpenCode client with a small session-oriented interface.
 * This intentionally does not emulate Ollama or OpenAI tool-call responses.
 */
export function createSessionClient(client) {
  if (!client?.server?.info || !client?.session?.create || !client?.session?.prompt) {
    throw new TypeError("client must be an @opencode/client-compatible client")
  }

  return Object.freeze({
    info: () => client.server.info(),

    async listModels(options = {}) {
      const response = await client.model.list(
        options.directory ? { location: { directory: options.directory } } : {},
      )
      return unwrap(response)
    },

    async createSession({ directory, model, title, denyTools = true }) {
      if (typeof directory !== "string" || directory.length === 0) {
        throw new TypeError("directory is required and must exist on the OpenCode host")
      }
      const input = {
        location: { directory },
        model: normalizeModel(model),
      }
      if (title) input.title = title
      if (denyTools) input.permissions = DENY_ALL.map((rule) => ({ ...rule }))
      return client.session.create(input)
    },

    async prompt({ sessionID, text, wait = true }) {
      if (typeof sessionID !== "string" || sessionID.length === 0) {
        throw new TypeError("sessionID is required")
      }
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new TypeError("text must be a non-empty string")
      }
      await client.session.prompt({ sessionID, text })
      if (wait) {
        if (!client.experimental?.session?.wait) {
          throw new Error("This OpenCode server/client does not provide experimental.session.wait")
        }
        await client.experimental.session.wait({ sessionID })
      }
      const response = await client.message.list({ sessionID, order: "asc" })
      return { sessionID, text: assistantText(response) }
    },

    async interrupt(sessionID) {
      if (typeof sessionID !== "string" || sessionID.length === 0) {
        throw new TypeError("sessionID is required")
      }
      return client.session.interrupt({ sessionID })
    },
  })
}

/** Connect to an existing OpenCode HTTP service. It never starts or stops it. */
export function connectOpenCode({ baseUrl, password, username = "opencode" }) {
  const url = parseBaseUrl(baseUrl)
  const authorization = basicAuthorization(password, username)
  const client = OpenCode.make({
    baseUrl: url,
    headers: { authorization },
  })
  return createSessionClient(client)
}

/** Discover a running local service without starting one. */
export async function connectLocalOpenCode() {
  const endpoint = await Service.discover()
  if (!endpoint) {
    throw new Error("No running local OpenCode service was discovered; start OpenCode separately")
  }
  const client = OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
  })
  return createSessionClient(client)
}
