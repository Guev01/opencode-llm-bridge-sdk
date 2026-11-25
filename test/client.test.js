import assert from "node:assert/strict"
import test from "node:test"
import { basicAuthorization, createSessionClient } from "../src/index.js"

function fakeClient() {
  const calls = []
  return {
    calls,
    server: { info: async () => ({ version: "2.4.1" }) },
    model: { list: async () => ({ data: [{ id: "big-pickle", providerID: "opencode" }] }) },
    session: {
      create: async (input) => {
        calls.push(["create", input])
        return { id: "ses_test" }
      },
      prompt: async (input) => calls.push(["prompt", input]),
      interrupt: async (input) => calls.push(["interrupt", input]),
    },
    experimental: { session: { wait: async (input) => calls.push(["wait", input]) } },
    message: {
      list: async (input) => {
        calls.push(["messages", input])
        return { data: [
          { type: "user", content: [{ type: "text", text: "question" }] },
          { type: "assistant", content: [{ type: "text", text: "answer" }] },
        ] }
      },
    },
  }
}

test("uses OpenCode Basic auth format without logging or URL credentials", () => {
  assert.equal(basicAuthorization("secret", "opencode"), `Basic ${Buffer.from("opencode:secret").toString("base64")}`)
  assert.throws(() => basicAuthorization("", "opencode"), /password is required/)
})

test("creates explicit-model sessions with tools denied by default", async () => {
  const api = fakeClient()
  const client = createSessionClient(api)
  const session = await client.createSession({
    directory: "/workspace",
    model: { providerID: "opencode", id: "big-pickle" },
  })
  assert.equal(session.id, "ses_test")
  const [, request] = api.calls.find(([name]) => name === "create")
  assert.deepEqual(request.model, { providerID: "opencode", id: "big-pickle" })
  assert.deepEqual(request.permissions, [{ action: "*", resource: "*", effect: "deny" }])
})

test("waits for completion and returns assistant text only", async () => {
  const api = fakeClient()
  const client = createSessionClient(api)
  const answer = await client.prompt({ sessionID: "ses_test", text: "hello" })
  assert.deepEqual(answer, { sessionID: "ses_test", text: "answer" })
  assert.deepEqual(api.calls.map(([name]) => name), ["prompt", "wait", "messages"])
})

test("does not turn empty/error/tool-only model responses into success", async () => {
  const failed = fakeClient()
  failed.message.list = async () => ({ data: [{ type: "assistant", error: { type: "ProviderAuthError", message: "provider login required" }, content: [] }] })
  const failedClient = createSessionClient(failed)
  await assert.rejects(
    failedClient.prompt({ sessionID: "ses_test", text: "hello" }),
    /OpenCode generation failed: provider login required/,
  )

  const empty = fakeClient()
  empty.message.list = async () => ({ data: [{ type: "assistant", finish: "tool-calls", content: [] }] })
  await assert.rejects(
    createSessionClient(empty).prompt({ sessionID: "ses_test", text: "hello" }),
    /does not expose tool-call/,
  )
})

test("requires explicit model, server-side directory, and non-empty prompt", async () => {
  const client = createSessionClient(fakeClient())
  await assert.rejects(client.createSession({ directory: "/workspace" }), /model must explicitly/)
  await assert.rejects(client.createSession({ model: { providerID: "opencode", id: "big-pickle" } }), /directory is required/)
  await assert.rejects(client.prompt({ sessionID: "ses_test", text: " " }), /non-empty string/)
})
