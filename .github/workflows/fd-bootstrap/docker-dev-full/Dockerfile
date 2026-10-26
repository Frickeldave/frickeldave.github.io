ARG DEV_BASE_IMAGE=ghcr.io/frickeldave/fd-dev-base:latest
FROM ${DEV_BASE_IMAGE}

USER root

# Auf fd-dev-base kommt nur SSH hinzu; die Toolchain bleibt im Basis-Image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    # Entsperrtes Konto ohne Passwort, sonst lehnt sshd Key-Logins ab.
    && usermod -p '*' appuser

COPY --chmod=755 .github/workflows/fd-bootstrap/docker-dev-full/entrypoint.sh /usr/local/bin/fd-dev-entrypoint
COPY --chmod=755 .github/workflows/fd-bootstrap/docker-dev-full/fd-clone-repo.sh /usr/local/bin/fd-clone-repo
COPY --chmod=755 .github/workflows/fd-bootstrap/docker-dev-full/fd-setup.sh /usr/local/bin/fd-setup
COPY --chmod=755 .github/workflows/fd-bootstrap/docker-dev-full/fd-welcome.sh /usr/local/bin/fd-welcome
RUN mkdir -p /usr/local/lib/fd-dev
COPY --chmod=644 .github/workflows/fd-bootstrap/docker-dev-full/fd-status.sh /usr/local/lib/fd-dev/fd-status.sh
COPY --chmod=644 scripts/copilot-environment.mjs /usr/local/lib/fd-dev/copilot-environment.mjs
COPY --chmod=644 scripts/copilot-provider.mjs /usr/local/lib/fd-dev/copilot-provider.mjs
COPY --chmod=644 scripts/platform-shared.mjs /usr/local/lib/fd-dev/platform-shared.mjs

# CRLF entfernen: Ein Windows-Checkout ließe den Kernel nach `/usr/bin/env bash\r` suchen.
RUN sed -i 's/\r$//' /usr/local/bin/fd-dev-entrypoint /usr/local/bin/fd-clone-repo \
    /usr/local/bin/fd-setup /usr/local/bin/fd-welcome /usr/local/lib/fd-dev/fd-status.sh

ENV FD_REPO_URL=https://github.com/Frickeldave/frickeldave.github.io.git \
    FD_REPO_BRANCH=dev \
    FD_REPO_DIR=/home/appuser/frickeldave.github.io \
    FD_SSH_PORT=2222

USER appuser
WORKDIR /home/appuser

EXPOSE 2222 3000
ENTRYPOINT ["/usr/local/bin/fd-dev-entrypoint"]
CMD ["sshd"]
