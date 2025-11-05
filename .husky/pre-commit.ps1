# PowerShell version of pre-commit checks

Write-Host ""
Write-Host "🚀 Pre-commit Quality Checks" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

Write-Host "💎 Running Prettier (Code Formatting)..." -ForegroundColor Yellow
Write-Host "   ↳ Ensuring consistent code style across all files"
npm run format
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ PRETTIER failed!" -ForegroundColor Red
  Write-Host "   ↳ Code formatting could not be applied automatically"
  Write-Host "   💡 Try running 'npm run format' manually to see the error"
  Write-Host ""
  exit 1
}

Write-Host "   ✅ Code formatting completed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Running ESLint (Code Quality & Best Practices)..." -ForegroundColor Yellow
Write-Host "   ↳ Checking for code quality issues and potential bugs"
npm run lint:check
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ ESLINT failed!" -ForegroundColor Red
  Write-Host "   ↳ Code quality issues found that need manual attention"
  Write-Host "   💡 Run 'npm run lint' to automatically fix some issues"
  Write-Host "   📋 Review the errors above and fix them before committing"
  Write-Host ""
  exit 1
}

Write-Host "   ✅ Code quality checks passed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Running Vale (Prose Linting)..." -ForegroundColor Yellow
Write-Host "   ↳ Checking documentation and content for style consistency"

if ((Test-Path './tools/vale') -or (Test-Path './tools/vale.exe')) {
  npm run prose:check
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ VALE failed!" -ForegroundColor Red
    Write-Host "   ↳ Prose style issues found in documentation"
    Write-Host "   💡 Review the suggestions above and edit the content manually"
    Write-Host "   📋 Vale cannot auto-fix - manual review required"
    Write-Host ""
    exit 1
  }
  Write-Host "   ✅ Prose style checks passed successfully" -ForegroundColor Green
} else {
  Write-Host "   ⚠️  Vale binary not found - skipping prose checks" -ForegroundColor Yellow
  Write-Host "   💡 Run 'npm run install-vale' to install Vale for prose linting"
}

Write-Host ""
Write-Host "🎉 All quality checks passed! Ready to commit." -ForegroundColor Green
Write-Host "   ↳ Your code is formatted, follows best practices, and prose is well-written"
Write-Host ""
