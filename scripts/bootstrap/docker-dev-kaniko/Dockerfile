# Build the executor from the official Kaniko source rather than inheriting an
# arbitrary executor image. v1.23.2's annotated tag resolves to this commit.
FROM ubuntu:24.04 AS builder

ARG DEBIAN_FRONTEND=noninteractive
ARG KANIKO_VERSION=v1.23.2
ARG KANIKO_COMMIT=1ae9a8416c14418625de90c1115052c0a6ebee07

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        git \
        golang-go \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --no-checkout https://github.com/GoogleContainerTools/kaniko.git /src/kaniko \
    && cd /src/kaniko \
    && git checkout --detach "${KANIKO_COMMIT}" \
    && test "$(git rev-parse HEAD)" = "${KANIKO_COMMIT}" \
    && test "$(git tag --points-at HEAD)" = "${KANIKO_VERSION}" \
    && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
        -trimpath \
        -buildvcs=false \
        -ldflags='-s -w' \
        -o /out/executor \
        ./cmd/executor

FROM ubuntu:24.04

# ubuntu:24.04 ships without CA certificates. The executor now runs in its own
# throwaway Job pod instead of borrowing the runner container's filesystem, so
# it needs its own trust store to reach github.com (Git build context) and
# ghcr.io (base-image pull and push).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN if ! getent group 1000 >/dev/null; then \
        groupadd --gid 1000 kaniko; \
    fi \
    && useradd --no-log-init --create-home --non-unique --uid 1000 --gid 1000 --shell /usr/sbin/nologin kaniko \
    && mkdir -p /kaniko \
    && chown 1000:1000 /kaniko

COPY --from=builder --chown=1000:1000 /out/executor /kaniko/executor

USER 1000:1000

# The Kaniko build Job started by a future application deploy workflow sets an
# explicit `command: [/kaniko/executor]`, so this idle default only applies when
# the image is started manually for inspection.
ENTRYPOINT ["sleep", "infinity"]
