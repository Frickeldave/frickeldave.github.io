FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
ARG PLAYWRIGHT_VERSION=1.63.0
ARG COPILOT_VERSION=1.0.95
ARG SQUAD_VERSION=0.13.1
ARG KUBECTL_VERSION=v1.33.0
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        apt-transport-https \
        bash \
        bash-completion \
        build-essential \
        ca-certificates \
        curl \
        findutils \
        fontconfig \
        git \
        gnupg \
        gosu \
        gzip \
        iproute2 \
        jq \
        less \
        locales \
        lsof \
        nano \
        openssh-client \
        procps \
        python-is-python3 \
        python3 \
        python3-pil \
        python3-pip \
        python3-venv \
        ripgrep \
        tar \
        tmux \
        unzip \
        util-linux \
        vim \
        wget \
    && locale-gen en_US.UTF-8 \
    && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g "@github/copilot@${COPILOT_VERSION}" "@bradygaster/squad-cli@${SQUAD_VERSION}" \
    && npm cache clean --force \
    && copilot --version \
    && squad --version

RUN set -eu; \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$arch" in amd64|arm64) ;; *) echo "Unsupported kubectl architecture: $arch" >&2; exit 1 ;; esac; \
    kubectl_url="https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${arch}/kubectl"; \
    curl -fsSL "$kubectl_url" -o /tmp/kubectl; \
    curl -fsSL "${kubectl_url}.sha256" -o /tmp/kubectl.sha256; \
    printf '%s  %s\n' "$(cat /tmp/kubectl.sha256)" /tmp/kubectl | sha256sum --check --status -; \
    install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl; \
    rm -f /tmp/kubectl /tmp/kubectl.sha256; \
    kubectl version --client

RUN mkdir -p /home/appuser /opt/ms-playwright \
    && PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH} npx --yes playwright@${PLAYWRIGHT_VERSION} install-deps \
    && PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH} HOME=/root npx --yes playwright@${PLAYWRIGHT_VERSION} install chromium firefox webkit \
    && useradd --create-home --home-dir /home/appuser --shell /bin/bash appuser \
    && chown -R appuser:appuser /home/appuser /opt/ms-playwright \
    && chmod -R a+rX ${PLAYWRIGHT_BROWSERS_PATH} \
    && rm -rf /root/.npm /var/lib/apt/lists/*

COPY --chown=appuser:appuser --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Strip CRLF: a Windows checkout would make the kernel look for `/usr/bin/env bash\r`.
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

USER appuser
WORKDIR /home/appuser

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]
