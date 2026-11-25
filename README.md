# OpenCode Bridge SDK

Small Node.js wrapper for connecting applications to an **already-running OpenCode service** using the official `@opencode/client`.

This package is a session client, **not** an Ollama or OpenAI-compatible inference server. It does not turn OpenCode's free models into a public third-party API and does not return PentAGI-style tool calls. OpenCode's documented API is session-oriented; OpenCode itself controls any tools enabled on its side.

## Install

```sh
npm install github:Guev01/opencode-llm-bridge-sdk
```

The package is currently distributed from this public GitHub repository; it is not published to the npm registry.

Requires Node.js 20 or newer and OpenCode 2.4.1-compatible session endpoints.

## Connect to a service

```js
import { connectOpenCode } from "opencode-llm-bridge-sdk"

const client = connectOpenCode({
  baseUrl: process.env.OPENCODE_URL,
  password: process.env.OPENCODE_SERVER_PASSWORD,
})

const info = await client.info()
console.log(info.version)

const session = await client.createSession({
  directory: "/workspace", // path as seen inside the OpenCode host/container
  model: { providerID: "opencode", id: "big-pickle" },
  title: "project task",
})

const answer = await client.prompt({ sessionID: session.id, text: "Responde solo OK" })
console.log(answer.text)
```

## Run OpenCode in Docker

The repository includes a pinned, non-root image and a Compose example in `examples/docker/`. Set `OPENCODE_SERVER_PASSWORD` through a secret manager or protected environment file, then run Compose from that directory. The example does not publish the API port to the host; attach only trusted application containers to its private Compose network. The writable `/workspace` volume is the server-side project directory passed to `createSession()`.

This starts an OpenCode service, not an OpenAI/Ollama-compatible endpoint. A separate compatibility gateway would be required for applications that expect `/v1/chat/completions` and structured tool-call round trips.

The model must be explicit; the SDK never retries against another model or provider. An explicit model ID does **not** by itself prove that a provider is free; inspect the OpenCode model catalog and account/quota before use.

For a local service, `connectLocalOpenCode()` discovers it without starting or stopping it. If no service is running, it fails with an actionable error.

## Boundaries and safety

- The password is sent using HTTP Basic auth. Keep it server-side in a secret store; do not embed it in a browser, APK, repository, or URL.
- Do not publish the OpenCode service port to the public internet. Prefer a private Docker network; use TLS/authentication for any remote route.
- Sessions default to denying OpenCode tools. `denyTools: false` delegates tool permissions to the OpenCode configuration; this SDK never auto-approves permission prompts.
- `directory` is a path on the OpenCode host, not the calling application.
- OpenCode's HTTP/session API is version-sensitive. Pin and validate the OpenCode version used by each deployment.
- This SDK reads the final assistant text only. It does not pass tool calls from OpenCode to a caller, nor execute PentAGI tools.
- There is no automatic paid-model fallback. Model pricing, free quota and availability remain controlled by the configured OpenCode provider.
- A model name containing `free` is not a guarantee of unlimited use or availability. If the provider reports a quota/authentication error, the caller gets an error; select nothing else automatically.

## Development

```sh
npm ci
npm test
```
