#!/bin/bash
set -e

# Vale Version
VALE_VERSION="3.7.1"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Architecture mapping
case $ARCH in
  x86_64) ARCH="64-bit" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# OS specific settings
case $OS in
  linux)
    BINARY_NAME="vale_${VALE_VERSION}_Linux_${ARCH}.tar.gz"
    ;;
  darwin)
    BINARY_NAME="vale_${VALE_VERSION}_macOS_${ARCH}.tar.gz"
    ;;
  *)
    echo "Unsupported OS: $OS"
    echo "Please use the PowerShell script for Windows: scripts/install-vale.ps1"
    exit 1
    ;;
esac

# Download and extract Vale
echo "Downloading Vale ${VALE_VERSION} for ${OS} ${ARCH}..."
mkdir -p ./.vale
timeout 60 curl -L --progress-bar --max-time 30 "https://github.com/errata-ai/vale/releases/download/v${VALE_VERSION}/${BINARY_NAME}" | tar -xz -C ./.vale || {
    echo "Error: Failed to download or extract Vale"
    exit 1
}

# Make executable
chmod +x ./.vale/vale

# Clean up .vale directory
echo "Cleaning up .vale directory..."
rm -f ./.vale/LICENSE ./.vale/README.md 2>/dev/null || true

echo "Vale installed successfully in ./.vale"

# Install Vale styles
echo ""
echo "Installing Vale styles..."

# Create styles directory
mkdir -p ./.vale/styles

# Remove existing styles to ensure fresh download
echo "Removing existing styles for fresh installation..."
rm -rf ./.vale/styles/Microsoft ./.vale/styles/write-good 2>/dev/null || true

# Download and install Microsoft style
echo "Downloading Microsoft style..."
timeout 60 git clone --depth 1 https://github.com/errata-ai/Microsoft.git ./.vale/styles/Microsoft || {
    echo "Error: Failed to download Microsoft style"
    exit 1
}

# Clean up Microsoft style directory
echo "Cleaning up Microsoft style..."
cd ./.vale/styles/Microsoft
rm -rf .github .gitignore .yamllint.yml Gemfile LICENSE README.md features fixtures coverage Gemfile.lock 2>/dev/null || true
cd ../../../

# Download and install write-good style
echo "Downloading write-good style..."
timeout 60 git clone --depth 1 https://github.com/errata-ai/write-good.git ./.vale/styles/write-good || {
    echo "Error: Failed to download write-good style"
    exit 1
}

# Fix write-good structure and clean up
echo "Cleaning up write-good style..."
cd ./.vale/styles/write-good
if [ -d "write-good" ]; then
    mv write-good/* . 2>/dev/null || true
    rmdir write-good 2>/dev/null || true
fi
rm -rf .git .gitignore .travis.yml .yamllint.yml CHANGELOG.md Gemfile LICENSE README.md features fixtures Gemfile.lock 2>/dev/null || true
cd ../../../

# Install mdx2vast for MDX support
echo "Installing mdx2vast for MDX format support..."
if command -v npm >/dev/null 2>&1; then
    timeout 60 npm install -g mdx2vast || {
        echo "Warning: Failed to install mdx2vast"
    }
    echo "mdx2vast installation completed"
else
    echo "Warning: npm not found, skipping mdx2vast installation"
    echo "Please install mdx2vast manually: npm install -g mdx2vast"
fi

# Download LibreOffice German dictionaries
echo ""
echo "Downloading LibreOffice German dictionaries..."
mkdir -p ./.vale/dictionaries

# Download German dictionary files
echo "Downloading German dictionary (de_DE)..."
timeout 300 curl -L --progress-bar --max-time 100 "https://github.com/LibreOffice/dictionaries/raw/refs/heads/master/de/de_DE_frami.dic" -o ./.vale/dictionaries/de_DE.dic || echo "Warning: Could not download de_DE.dic"
timeout 300 curl -L --progress-bar --max-time 100 "https://github.com/LibreOffice/dictionaries/raw/refs/heads/master/de/de_DE_frami.aff" -o ./.vale/dictionaries/de_DE.aff || echo "Warning: Could not download de_DE.aff"

# Convert dictionaries from ISO-8859-1 to UTF-8
echo "Converting dictionaries to UTF-8..."
if command -v iconv >/dev/null 2>&1; then
    iconv -f ISO-8859-1 -t UTF-8 ./.vale/dictionaries/de_DE.dic -o ./.vale/dictionaries/de_DE.dic.utf8 && mv ./.vale/dictionaries/de_DE.dic.utf8 ./.vale/dictionaries/de_DE.dic || echo "Warning: Could not convert de_DE.dic"
    iconv -f ISO-8859-1 -t UTF-8 ./.vale/dictionaries/de_DE.aff -o ./.vale/dictionaries/de_DE.aff.utf8 && mv ./.vale/dictionaries/de_DE.aff.utf8 ./.vale/dictionaries/de_DE.aff || echo "Warning: Could not convert de_DE.aff"
    # Update encoding declaration in .aff file
    sed -i 's/^SET ISO8859-1/SET UTF-8/' ./.vale/dictionaries/de_DE.aff
    echo "Dictionaries converted to UTF-8"
else
    echo "Warning: iconv not found, dictionaries may have encoding issues"
fi

echo "German dictionaries downloaded to ./.vale/dictionaries/"

echo ""
echo "Vale styles installed successfully:"
echo "  - Microsoft: .vale/styles/Microsoft"
echo "  - write-good: .vale/styles/write-good"
echo "  - MDX format support: mdx2vast (global npm package)"
echo "  - German dictionaries: .vale/dictionaries/"
echo "Add ./.vale to your PATH or use ./.vale/vale directly"
echo ""
echo "Test the installation with: ./.vale/vale --version"
