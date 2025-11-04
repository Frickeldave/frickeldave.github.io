param(
    [string]$ValeVersion = "3.7.1"
)

$ErrorActionPreference = "Stop"

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "64-bit" } else { "32-bit" }
$binaryName = "vale_${ValeVersion}_Windows_${arch}.zip"

# Create .vale directory
if (!(Test-Path ".vale")) {
    New-Item -ItemType Directory -Path ".vale" | Out-Null
}

# Download Vale
Write-Host "Downloading Vale $ValeVersion for Windows $arch..."
$downloadUrl = "https://github.com/errata-ai/vale/releases/download/v$ValeVersion/$binaryName"
$zipPath = ".vale/vale.zip"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath
} catch {
    Write-Host "Error: Failed to download Vale" -ForegroundColor Red
    exit 1
}

# Extract Vale
Expand-Archive -Path $zipPath -DestinationPath ".vale" -Force
Remove-Item $zipPath

# Clean up .vale directory
Write-Host "Cleaning up .vale directory..."
Remove-Item -Path ".vale/LICENSE", ".vale/README.md" -Force -ErrorAction SilentlyContinue

Write-Host "Vale installed successfully in ./.vale"

# Install Vale styles
Write-Host ""
Write-Host "Installing Vale styles..."

# Create styles directory
if (!(Test-Path ".vale/styles")) {
    New-Item -ItemType Directory -Path ".vale/styles" -Force | Out-Null
}

# Remove existing styles to ensure fresh download
Write-Host "Removing existing styles for fresh installation..."
Remove-Item -Path ".vale/styles/Microsoft", ".vale/styles/write-good" -Recurse -Force -ErrorAction SilentlyContinue

# Download and install Microsoft style
Write-Host "Downloading Microsoft style..."
try {
    & git clone --depth 1 https://github.com/errata-ai/Microsoft.git .vale/styles/Microsoft
} catch {
    Write-Host "Error: Failed to download Microsoft style" -ForegroundColor Red
    exit 1
}

# Clean up Microsoft style directory
Write-Host "Cleaning up Microsoft style..."
$microsoftPath = ".vale/styles/Microsoft"
Push-Location $microsoftPath
Remove-Item -Path ".github", ".gitignore", ".yamllint.yml", "Gemfile", "LICENSE", "README.md", "features", "fixtures", "coverage", "Gemfile.lock" -Recurse -Force -ErrorAction SilentlyContinue
Pop-Location

# Download and install write-good style
Write-Host "Downloading write-good style..."
try {
    & git clone --depth 1 https://github.com/errata-ai/write-good.git .vale/styles/write-good
} catch {
    Write-Host "Error: Failed to download write-good style" -ForegroundColor Red
    exit 1
}

# Fix write-good structure and clean up
Write-Host "Cleaning up write-good style..."
$writeGoodPath = ".vale/styles/write-good"
Push-Location $writeGoodPath
if (Test-Path "write-good") {
    Move-Item -Path "write-good/*" -Destination "." -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "write-good" -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-Item -Path ".git", ".gitignore", ".travis.yml", ".yamllint.yml", "CHANGELOG.md", "Gemfile", "LICENSE", "README.md", "features", "fixtures", "Gemfile.lock" -Recurse -Force -ErrorAction SilentlyContinue
Pop-Location

# Install mdx2vast for MDX support
Write-Host "Installing mdx2vast for MDX format support..."
try {
    $npmExists = $null -ne (where.exe npm 2>null)
    if ($npmExists) {
        & npm install -g mdx2vast
        Write-Host "mdx2vast installation completed"
    } else {
        Write-Host "Warning: npm not found, skipping mdx2vast installation" -ForegroundColor Yellow
        Write-Host "Please install mdx2vast manually: npm install -g mdx2vast"
    }
} catch {
    Write-Host "Warning: Failed to install mdx2vast" -ForegroundColor Yellow
}

# Success message
Write-Host ""
Write-Host "Vale styles installed successfully:" -ForegroundColor Green
Write-Host "  - Microsoft: .vale/styles/Microsoft"
Write-Host "  - write-good: .vale/styles/write-good"
Write-Host "  - MDX format support: mdx2vast (global npm package)"
Write-Host "  - German dictionaries: .vale/dictionaries/ (de_DE, de_AT, de_CH)"
Write-Host "Add ./.vale to your PATH or use ./.vale/vale.exe directly"
Write-Host ""
Write-Host "Test the installation with: ./.vale/vale.exe --version"
