# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2024-07-26

### Added
- **Pull Request Template**: Added a `.github/PULL_REQUEST_TEMPLATE.md` to standardize contributions.
- **Changelog Link**: Added a badge linking to this changelog in the main `README.md`.

### Changed
- **Production Polish**: Refined the application based on a final production-readiness review.
- **Version Bump**: Incremented application version to `1.3.0` across the UI and health-check endpoint.

## [1.2.0] - 2024-07-25

### Added
- **Self-Deployment**: New "Redeploy Yourself" button triggers a GitHub Actions workflow to redeploy the application.
- **Live Workflow Status**: Added a live polling component to display the real-time status of GitHub Actions workflows.
- **Production-Ready CI/CD**: Updated GitHub Actions workflow to include linting, testing, security audit, and automated deployment to Vercel on push to `main`.
- `/health` endpoint now includes application version for better monitoring.
- Added this `CHANGELOG.md` file to track project versions.

### Changed
- Improved error handling for Gemini API key validation across the application.
- Upgraded CI environment to Node.js 20.x for better performance and security.

## [1.0.0] - 2024-07-01

### Added
- Initial release of SlavkoShell.
- Core features: AI-powered script analysis, multi-provider deployment simulation, interactive chat UI, and live audit log via SlavkoProtocol™.
- Support for Text-to-Speech (TTS) for model responses.
- Light/Dark mode and theme switching capabilities.
- Real deployment integration for Vercel, Netlify, AWS, and Azure.