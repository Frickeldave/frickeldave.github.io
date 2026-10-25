# No default on purpose: bootstrap.mjs always supplies this value via
# `--build-arg DEV_BASE_IMAGE=<tag from bootstrap.json>`; a standalone
# `docker build` must pass DEV_BASE_IMAGE explicitly as well.
ARG DEV_BASE_IMAGE
FROM ${DEV_BASE_IMAGE}

ARG RUNNER_VERSION=2.337.0
ARG GO_CONTAINERREGISTRY_VERSION=v0.22.1
ARG GO_CONTAINERREGISTRY_TARBALL_SHA256=0ab7a1d6932a213aed964ce97666c3077fe691c8606413674a8b3e0b9ec4cda0
# A future application deploy workflow runs
# `kubectl apply/create/wait/logs/delete` directly on this runner container:
# applying manifests, refreshing the ghcr-pull-secret and managing the
# throwaway Kaniko build Jobs. This image never shipped a kubectl binary
# before, so every kubectl call would have failed with "command not found" the
# first time any of these steps actually ran.
ARG KUBECTL_VERSION=v1.33.0
ARG KUBECTL_SHA256=9efe8d3facb23e1618cba36fb1c4e15ac9dc3ed5a2c2e18109e4a66b2bac12dc

USER root

RUN curl -fsSL -o /usr/local/src/go-containerregistry.tar.gz "https://github.com/google/go-containerregistry/releases/download/${GO_CONTAINERREGISTRY_VERSION}/go-containerregistry_Linux_x86_64.tar.gz" \
    && echo "${GO_CONTAINERREGISTRY_TARBALL_SHA256}  /usr/local/src/go-containerregistry.tar.gz" | sha256sum -c - \
    && tar -xzf /usr/local/src/go-containerregistry.tar.gz -C /usr/local/bin crane \
    && rm /usr/local/src/go-containerregistry.tar.gz

RUN curl -fsSL -o /usr/local/bin/kubectl "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && echo "${KUBECTL_SHA256}  /usr/local/bin/kubectl" | sha256sum -c - \
    && chmod +x /usr/local/bin/kubectl

RUN mkdir -p /home/appuser/actions-runner \
    && chown -R appuser:appuser /home/appuser/actions-runner

WORKDIR /home/appuser/actions-runner

RUN curl -fsSL -o actions-runner.tar.gz "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    && tar --no-same-owner -xzf actions-runner.tar.gz \
    && rm actions-runner.tar.gz \
    && ./bin/installdependencies.sh \
    && chown -R appuser:appuser /home/appuser/actions-runner \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=appuser:appuser --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Strip CRLF: a Windows checkout would make the kernel look for `/usr/bin/env bash\r`.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

USER appuser
WORKDIR /home/appuser/actions-runner

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
