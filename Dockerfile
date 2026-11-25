FROM node:22-bookworm-slim

ARG OPENCODE_VERSION=2.4.1
ENV OPENCODE_VERSION=${OPENCODE_VERSION}
ENV PATH=/home/opencode/.opencode/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && groupadd --system opencode \
    && useradd --system --gid opencode --create-home --home-dir /home/opencode opencode \
    && mkdir -p /workspace \
    && chown opencode:opencode /workspace \
    && rm -rf /var/lib/apt/lists/*

USER opencode
WORKDIR /workspace
RUN curl -fsSL https://opencode.ai/v2/install -o /tmp/opencode-install.sh \
    && echo 'b60226508704fc97d7b9d12ae6d4a6f819dfe02b22c190a0425c14ef632b056b  /tmp/opencode-install.sh' | sha256sum -c - \
    && bash /tmp/opencode-install.sh --version "${OPENCODE_VERSION}" --no-modify-path \
    && rm /tmp/opencode-install.sh

ENV OPENCODE_SERVER_USERNAME=opencode
ENV OPENCODE_SERVER_PORT=4096
EXPOSE 4096

CMD ["sh", "-ec", "test -n \"${OPENCODE_SERVER_PASSWORD:-}\" || { echo 'OPENCODE_SERVER_PASSWORD is required' >&2; exit 1; }; exec opencode serve --hostname 0.0.0.0 --port \"${OPENCODE_SERVER_PORT}\""]
