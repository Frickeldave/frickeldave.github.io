# Dockerfile for developers

Die folgendes Docker Datei zeigt die konkrete Konfiguration der Entwicklungsumgebung die im Anschluß auch per SSH erreichbar ist. 


## Verwendete Variablen

| Variable                         | Bedeutung                                                            | Beispielwert                                 |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| `fdd_build_node_image`           | Basis-Image fuer den Build                                           | `node:24-bookworm`                           |
| `fdd_gid`                        | Group ID des Entwickler-Users im Container                           | `1000` (Id der lokalen non-admin user group) |
| `fdd_uid`                        | User ID des Entwickler-Users im Container                            | `1000` (Id der lokalen non-admin user group) |
| `fdd_build_exec_user`            | Name des Standard-Users im Container                                 | `appuser`                                    |
| `fdd_ssh_public_key`             | Public SSH Key fuer `authorized_keys`                                | `ssh-ed25519 AAAAC3Nza... dev@laptop`        |
| `fdd_ssh_port`                   | SSH-Port im Container                                                | `2222`                                       |
| `fdd_ssh_password_auth`          | Passwort-Auth fuer SSH (`yes`/`no`)                                  | `no`                                         |
| `fdd_nvm_version`                | Zu installierende NVM-Version                                        | `0.39.7`                                     |
| `fdd_node_version`               | Node.js Version fuer NVM                                             | `24.18.0`                                    |
| `fdd_git_private_key_passphrase` | Passphrase des privaten Deploy-Keys                                  | `my-strong-passphrase` (use a vault tool)    |
| `fdd_git_user_name`              | Globaler Git User Name im Container                                  | `Max Mustermann`                             |
| `fdd_git_user_email`             | Globale Git User E-Mail im Container                                 | `max.mustermann@example.com`                 |
| `fdd_build_image_name`           | Docker Image Name fuer den Runtime-Container                         | `fdd-dev`                                    |
| `fdd_build_image_tag`            | Docker Image Tag                                                     | `latest`                                     |
| `fdd_build_host_port`            | Port auf dem Hostsystem                                              | `2222`                                       |
| `fdd_build_container_port`       | Ziel-Port im Container                                               | `2222`                                       |
| `fdd_github_token`               | GitHub Token, der als `GITHUB_TOKEN` in den Container injiziert wird | `github_pat_xxxxxxxxx`                       |


## Docker Compose 

```yaml
services:

  fdd:
    container_name: fdd
    hostname: fdd
    image: {{ fdd_build_image_name }}:{{ fdd_build_image_tag }}
    restart: always
    ports:
      - "{{ fdd_build_host_port }}:{{ fdd_build_container_port }}"
    environment:
      - TERM=xterm
      - GITHUB_TOKEN={{ fdd_github_token }}
    volumes:
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    networks:
      - homenet_waltraud

networks:
  homenet_waltraud:
    external: true
    name: homenet_waltraud
```

## Dockerfile

```dockerfile

# Dockerfile for Debian container with SSH, NVM and Node.js

FROM {{ fdd_build_node_image }}

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

####################################################################################
# Update and install necessary packages
####################################################################################
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    openssh-server \
    openssh-client \
    sudo \
    bash \
    git \
    vim \
    nano \
    && rm -rf /var/lib/apt/lists/*

####################################################################################
# Install system libraries required for Playwright (Chromium)
####################################################################################
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    libxcb-shm0 \
    libx11-xcb1 \
    libxcursor1 \
    libxi6 \
    libxtst6 \
    libx11-6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

####################################################################################
# Install system libraries required for Playwright (WebKit)
####################################################################################
RUN apt-get update && apt-get install -y --no-install-recommends \
    libhyphen0 \
    libgles2 \
    libgtk-4-1 \
    libgraphene-1.0-0 \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    gstreamer1.0-plugins-good \
    gstreamer1.0-libav \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libcairo-gobject2 \
    libharfbuzz0b \
    libharfbuzz-icu0 \
    libicu72 \
    libfontconfig1 \
    libfreetype6 \
    libgdk-pixbuf-2.0-0 \
    libpng16-16 \
    libjpeg62-turbo \
    libwebp7 \
    libwebpdemux2 \
    libwebpmux3 \
    libavif15 \
    libjxl0.7 \
    liblcms2-2 \
    libxml2 \
    libxslt1.1 \
    libsoup-3.0-0 \
    libsecret-1-0 \
    libenchant-2-2 \
    libepoxy0 \
    libevent-2.1-7 \
    libflite1 \
    libopus0 \
    libmanette-0.2-0 \
    libwayland-client0 \
    libwayland-egl1 \
    libatomic1 \
    libwoff1 \
    libgstreamer-gl1.0-0 \
    && rm -rf /var/lib/apt/lists/*

####################################################################################
# Install GitHub CLI
####################################################################################
RUN mkdir -p -m 755 /etc/apt/keyrings \
        && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
            | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
        && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
        && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
            | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
        && apt-get update \
        && apt-get install -y gh \
        && rm -rf /var/lib/apt/lists/*

####################################################################################
# Configure user
####################################################################################

# Create non-root user for running the application with specific UID/GID to match host user
# Note: useradd leaves the account locked ("!" in /etc/shadow). With "UsePAM no",
# sshd rejects locked accounts for ALL auth methods (incl. public key) with
# "account is locked". Set the password hash to "*" to unlock the account for
# key-based login while still disallowing any password login.
RUN groupadd -g {{ fdd_gid }} {{ fdd_build_exec_user }} && \
    useradd -r -m -u {{ fdd_uid }} -g {{ fdd_build_exec_user }} -s /bin/bash {{ fdd_build_exec_user }} && \
    usermod -p '*' {{ fdd_build_exec_user }}

# Configure the home dir of the default user and SSH
RUN mkdir -p /run/sshd /home/{{ fdd_build_exec_user }}/.ssh \
    && chown -R {{ fdd_build_exec_user }}:{{ fdd_build_exec_user }} /home/{{ fdd_build_exec_user }} \
    && chmod 700 /home/{{ fdd_build_exec_user }}/.ssh \
    && touch /home/{{ fdd_build_exec_user }}/.ssh/authorized_keys \
    && chown {{ fdd_build_exec_user }}:{{ fdd_build_exec_user }} /home/{{ fdd_build_exec_user }}/.ssh/authorized_keys \
    && chmod 600 /home/{{ fdd_build_exec_user }}/.ssh/authorized_keys \
    && echo "{{ fdd_ssh_public_key }}" >> /home/{{ fdd_build_exec_user }}/.ssh/authorized_keys

####################################################################################
# Confiure SSH daemon file with secure settings
####################################################################################
RUN cat > /etc/ssh/sshd_config << 'SSHD_CONFIG' && \
chmod 600 /etc/ssh/sshd_config

Protocol 2
ListenAddress 0.0.0.0
Port {{ fdd_ssh_port }}
PermitRootLogin no
AllowGroups {{ fdd_build_exec_user }}
LoginGraceTime 60
StrictModes no

Ciphers aes128-gcm@openssh.com,aes256-gcm@openssh.com,aes128-ctr,aes192-ctr,aes256-ctr
HostKeyAlgorithms ecdsa-sha2-nistp256,rsa-sha2-256,rsa-sha2-512,ssh-ed25519
HostKey /etc/ssh/ssh_host_rsa_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_ed25519_key
KexAlgorithms diffie-hellman-group-exchange-sha256,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521
MACs hmac-sha2-256,hmac-sha2-512
RekeyLimit 1G 1H

TCPKeepAlive no
ClientAliveCountMax 3
ClientAliveInterval 15
MaxStartups 10:30:60
MaxSessions 10

PubkeyAuthentication yes
IgnoreRhosts yes
HostbasedAuthentication no
IgnoreUserKnownHosts yes
PasswordAuthentication {{ fdd_ssh_password_auth | default('no') }}
PermitEmptyPasswords no
KbdInteractiveAuthentication no
MaxAuthTries 4

UsePAM no
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
SSHD_CONFIG

####################################################################################
# Setup NVM and Node.js
####################################################################################

# Switch to the non-root user
USER {{ fdd_build_exec_user }}

# Set working directory
WORKDIR /home/{{ fdd_build_exec_user }}

# Install NVM (Node Version Manager) and Node.js
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v{{ fdd_nvm_version }}/install.sh | bash && \
    export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    nvm install --no-progress {{ fdd_node_version }} && \
    nvm use {{ fdd_node_version }} && \
    nvm alias default {{ fdd_node_version }}

# Configure NVM in .bashrc for interactive shells
# Compose sets GITHUB_TOKEN for the container process, but SSH shells may not inherit
# that environment consistently (especially with UsePAM no). Source profile.d explicitly.
RUN echo 'export NVM_DIR="$HOME/.nvm"' >> /home/{{ fdd_build_exec_user }}/.bashrc && \
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /home/{{ fdd_build_exec_user }}/.bashrc && \
    echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> /home/{{ fdd_build_exec_user }}/.bashrc && \
    echo '[ -f /etc/profile.d/github_token.sh ] && . /etc/profile.d/github_token.sh' >> /home/{{ fdd_build_exec_user }}/.bashrc

# Configure npm global install path for non-root user and expose binaries.
ENV NPM_CONFIG_PREFIX="/home/{{ fdd_build_exec_user }}/.npm-global"
ENV PATH="/home/{{ fdd_build_exec_user }}/.npm-global/bin:/home/{{ fdd_build_exec_user }}/.nvm/versions/node/v{{ fdd_node_version }}/bin:${PATH}"

# Install GitHub Copilot CLI globally with npm (requires Node.js + npm)
RUN export NVM_DIR="$HOME/.nvm" && \
    npm install -g @github/copilot

# Setup SSH private key for git clone for frickeldave repository access
# Copy key from build context, strip passphrase permanently so no interactive prompt is needed at runtime
COPY --chown={{ fdd_build_exec_user }}:{{ fdd_build_exec_user }} id_rsa_frickeldave /home/{{ fdd_build_exec_user }}/.ssh/id_ed25519_github_frickeldave_privatekey
RUN chmod 600 /home/{{ fdd_build_exec_user }}/.ssh/id_ed25519_github_frickeldave_privatekey \
        && if ssh-keygen -y -P "" -f /home/{{ fdd_build_exec_user }}/.ssh/id_ed25519_github_frickeldave_privatekey >/dev/null 2>&1; then \
                 echo "SSH key already has no passphrase"; \
             else \
                 KEY_PASSPHRASE="$(printf '%s' '{{ fdd_git_private_key_passphrase | b64encode }}' | base64 -d)"; \
                 ssh-keygen -p -P "${KEY_PASSPHRASE}" -N "" -f /home/{{ fdd_build_exec_user }}/.ssh/id_ed25519_github_frickeldave_privatekey \
                     || (echo "Configured fdd_git_private_key_passphrase does not match fdd_git_private_key" && exit 1); \
             fi \
    && ssh-keyscan github.com >> /home/{{ fdd_build_exec_user }}/.ssh/known_hosts \
    && chmod 644 /home/{{ fdd_build_exec_user }}/.ssh/known_hosts

# Deploy SSH client config to use correct key per github host alias
COPY --chown={{ fdd_build_exec_user }}:{{ fdd_build_exec_user }} ssh_config /home/{{ fdd_build_exec_user }}/.ssh/config
RUN chmod 600 /home/{{ fdd_build_exec_user }}/.ssh/config

# Configure git user
RUN git config --global user.name "{{ fdd_git_user_name }}" \
    && git config --global user.email "{{ fdd_git_user_email }}"

# Clone the frickeldave.github.io repository via SSH (using github-frickeldave alias from ssh_config)
RUN git clone git@github-frickeldave:Frickeldave/frickeldave.github.io.git /home/{{ fdd_build_exec_user }}/frickeldave.github.io

# Switch back to root to start SSH daemon
USER root

# Create startup script that starts SSH daemon properly
RUN echo '#!/bin/bash' > /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo 'mkdir -p /run/sshd' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo 'if [[ -n "${GITHUB_TOKEN:-}" ]]; then' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo '  printf "export GITHUB_TOKEN=%q\\n" "${GITHUB_TOKEN}" > /etc/profile.d/github_token.sh' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo '  chmod 0644 /etc/profile.d/github_token.sh' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo 'fi' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo '/usr/sbin/sshd -D -e &' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && echo 'tail -f /dev/null' >> /home/{{ fdd_build_exec_user }}/startup.sh \
    && chmod +x /home/{{ fdd_build_exec_user }}/startup.sh

# Expose SSH port
EXPOSE {{ fdd_ssh_port }}

# Set entrypoint
ENTRYPOINT ["/home/{{ fdd_build_exec_user }}/startup.sh"]

```