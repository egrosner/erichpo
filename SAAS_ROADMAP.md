# SaaS Roadmap

Prioritized list of work to turn erichpo from an MVP into a production SaaS. Organized into phases — each phase should be shippable on its own.

---

## Phase 1: Foundation (Must-Have Before Charging Money)

### Payment Model & Pricing Strategy

**Recommended pricing structure (usage-based + seat hybrid):**

| | Free | Team | Business |
|---|---|---|---|
| Price | $0 | $10/workspace/mo | $25/workspace/mo |
| Workspaces | 1 | 3 | Unlimited |
| Active PR channels | 5 concurrent | 50 concurrent | Unlimited |
| Message sync | Last 24h of comments | Full history | Full history |
| User mappings | Manual only | Auto-resolve | Auto-resolve + SSO |
| CI status sync | Basic (pass/fail) | Detailed (per-check) | Detailed + custom |
| Channel retention | Archive immediately | Configurable delay | Configurable + export |
| Support | Community | Email (48h SLA) | Priority (4h SLA) |
| Audit log | - | 30 days | 1 year |

**Why this model works for a dev tool:**
- Free tier is generous enough to prove value on a small team
- Usage gates (concurrent PR channels) scale naturally with team size
- Per-workspace pricing is simple to understand and avoids per-seat counting complexity
- Annual discount (2 months free) incentivizes commitment

### Stripe Integration (Backend)
- [ ] Add `stripe` npm package and create a `BillingModule` in NestJS
- [ ] Create Stripe products and prices for each tier (use Stripe Price IDs in config, not hardcoded)
- [ ] Add Prisma models: `Subscription` (workspaceId, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, tier), `UsageRecord` (workspaceId, metric, count, periodStart, periodEnd), `Invoice` (workspaceId, stripeInvoiceId, amount, status, pdfUrl)
- [ ] Implement `BillingService` with methods: createCheckoutSession, createPortalSession, getSubscription, cancelSubscription, changeplan
- [ ] Add `POST /api/billing/checkout` — create Stripe Checkout session (redirect user to Stripe-hosted payment page)
- [ ] Add `POST /api/billing/portal` — create Stripe Customer Portal session (for managing payment methods, viewing invoices, canceling)
- [ ] Add `GET /api/billing/subscription` — return current workspace subscription status and usage
- [ ] Add `POST /api/webhooks/stripe` — receive Stripe webhooks (signature-verified, separate from GitHub/Slack webhook routes)

### Stripe Webhook Handling
- [ ] Handle `checkout.session.completed` — activate subscription, link Stripe customer to workspace
- [ ] Handle `invoice.paid` — record successful payment, reset usage counters for new period
- [ ] Handle `invoice.payment_failed` — notify workspace admins via email and in-app banner
- [ ] Handle `customer.subscription.updated` — sync plan changes (upgrades/downgrades)
- [ ] Handle `customer.subscription.deleted` — downgrade to Free tier, apply feature gates
- [ ] Add idempotency for Stripe webhooks (reuse `WebhookDelivery` pattern with Stripe event IDs)

### Feature Gating
- [ ] Create `PlanGuard` NestJS guard that checks workspace subscription tier before allowing actions
- [ ] Gate PR channel creation: check concurrent active channel count against tier limit
- [ ] Gate message sync depth: Free tier only syncs comments from last 24h
- [ ] Gate workspace creation: check total workspace count against tier limit
- [ ] Return clear `402 Payment Required` or `403 Forbidden` responses with upgrade prompts when limits hit
- [ ] Add `X-Plan-Limit` and `X-Plan-Usage` response headers so the frontend can show usage bars

### Usage Tracking & Metering
- [ ] Track per billing period: PR channels created, messages synced, webhook events processed
- [ ] Increment counters in `UsageRecord` on each billable action (channel creation, message sync)
- [ ] Add usage summary endpoint: `GET /api/billing/usage` (current period stats)
- [ ] Optional: report usage to Stripe Billing Meter for usage-based overage charges
- [ ] Add usage approaching-limit warnings (80%, 95%, 100%) surfaced in UI and optionally via Slack DM

### Billing UI (Frontend)
- [ ] Build pricing/plan selection page (shown to workspace admins)
- [ ] Add "Upgrade" CTA banners when approaching or hitting plan limits
- [ ] Integrate Stripe Checkout redirect for initial subscription
- [ ] Integrate Stripe Customer Portal redirect for managing billing (payment method, invoices, cancel)
- [ ] Show current plan, usage meters, and next billing date on workspace settings page
- [ ] Show invoice history (pulled from Stripe via API or cached in DB)
- [ ] Add plan comparison modal when users hit a feature gate
- [ ] Handle trial expiration and grace period UI states

### Payment Operations
- [ ] Implement 14-day free trial for Team/Business (no credit card required to start)
- [ ] Implement annual billing option (2 months free discount)
- [ ] Add coupon/promo code support via Stripe Coupons
- [ ] Implement grace period: 7 days after payment failure before downgrading
- [ ] Send dunning emails on payment failure (day 1, day 3, day 7)
- [ ] Add admin email notifications for: subscription created, payment received, payment failed, plan changed, trial ending
- [ ] Set up Stripe Tax for automatic tax collection (or integrate with a tax provider)

### CI/CD Pipeline
- [ ] Add GitHub Actions workflow: lint + typecheck + test on every PR
- [ ] Add GitHub Actions workflow: build Docker images on merge to main
- [ ] Add automated deployment pipeline (e.g., Railway, Fly.io, or AWS ECS)
- [ ] Add Dependabot or Renovate for dependency updates
- [ ] Add CodeQL or similar for security scanning

### Testing
- [ ] Write unit tests for core services (IntegrationService, SlackService, GitHubService)
- [ ] Write unit tests for auth guards (JWT, GitHub signature, Slack signature)
- [ ] Write integration tests for webhook processing (idempotency, error handling)
- [ ] Write integration tests for OAuth flows (GitHub + Slack)
- [ ] Write E2E tests for admin API endpoints
- [ ] Write frontend component tests (dashboard, workspace switcher, setup wizard)
- [ ] Target 70%+ code coverage; enforce in CI

### Rate Limiting
- [ ] Add `@nestjs/throttler` to all public endpoints
- [ ] Implement per-workspace rate limits for webhook processing
- [ ] Add rate limit headers to API responses
- [ ] Implement backoff/retry logic for outbound GitHub/Slack API calls (respect 429s)

---

## Phase 2: Security & Compliance

### Encrypt Sensitive Data at Rest
- [ ] Encrypt Slack bot tokens in the database (use a KMS or application-level encryption)
- [ ] Encrypt GitHub user access tokens in the database
- [ ] Encrypt GitHub App private key at rest (not just base64)
- [ ] Add secrets rotation support (re-encrypt on key rotation)

### Audit Logging
- [ ] Create `AuditLog` table (who, what, when, workspace, IP, user agent)
- [ ] Log all admin actions (role changes, member invites/removals, org mapping changes)
- [ ] Log all OAuth token grants and revocations
- [ ] Build audit log viewer in admin UI
- [ ] Add log retention policy (configurable per workspace)

### Auth Hardening
- [ ] Add API key support for programmatic access / CI integrations
- [ ] Implement CSRF tokens for state-changing endpoints (beyond OAuth state)
- [ ] Add session listing and revocation UI (show active sessions, "log out everywhere")
- [ ] Consider MFA for admin users
- [ ] Rotate JWT signing keys without invalidating all sessions

### Data Privacy
- [ ] Add data export endpoint (GDPR "right to portability")
- [ ] Add account/workspace deletion with cascade cleanup
- [ ] Add privacy policy and terms of service pages
- [ ] Implement data retention policies (auto-delete webhook delivery records after N days)

---

## Phase 3: Observability & Reliability

### Monitoring & Alerting
- [ ] Add Sentry (or similar) for error tracking in backend and frontend
- [ ] Add structured logging with request IDs (correlation across webhook → Slack/GitHub calls)
- [ ] Add request logging middleware (method, path, status, duration, workspace)
- [ ] Expose Prometheus metrics endpoint (`/metrics`) — request count, latency, error rate
- [ ] Set up alerting for: webhook processing failures, elevated error rates, Slack/GitHub API errors
- [ ] Add health check improvements (check DB connectivity, Slack API reachability)

### Database & Scaling
- [ ] Migrate from SQLite to PostgreSQL for production (SQLite doesn't support concurrent writes well)
- [ ] Add connection pooling (PgBouncer or Prisma connection pool)
- [ ] Add database backups (automated daily snapshots)
- [ ] Add database migration CI check (ensure migrations are reversible)
- [ ] Consider read replicas if query load grows

### Uptime & Resilience
- [ ] Add webhook retry queue (dead-letter queue for failed processing)
- [ ] Implement circuit breaker for Slack/GitHub API calls
- [ ] Add graceful shutdown handling (drain in-flight requests)
- [ ] Load test webhook processing throughput
- [ ] Document SLA targets and incident response process

---

## Phase 4: User Experience & Growth

### User-Facing Dashboard
- [ ] Add PR channel activity feed (recent channels created, messages synced)
- [ ] Add per-workspace usage stats (PRs this month, messages synced, active users)
- [ ] Add PR channel list view (active channels, archived channels, link to PR)
- [ ] Show webhook delivery status / recent errors for workspace admins
- [ ] Add notification preferences UI (control what triggers Slack messages)

### Onboarding & Self-Service
- [ ] Build guided setup flow (install GitHub App → install Slack App → create first mapping)
- [ ] Add interactive walkthrough for first PR sync
- [ ] Add in-app help tooltips and documentation links
- [ ] Build a public marketing/landing page with pricing
- [ ] Add email notifications for account events (workspace invite, payment issues)

### Channel & Notification Configuration
- [ ] Make channel naming template configurable per workspace (not just prefix)
- [ ] Add configurable auto-archive delay (immediate on merge/close vs. after N hours)
- [ ] Allow per-repo opt-in/opt-out of PR channel creation
- [ ] Add channel description template (auto-populate with PR title, author, link)
- [ ] Support draft PR handling (create channel on draft? on ready-for-review?)

### Multi-Workspace Power Features
- [ ] Support many-to-many GitHub org ↔ Slack workspace mappings
- [ ] Add cross-workspace user identity linking
- [ ] Add workspace transfer (move ownership between users)
- [ ] Add workspace-level webhook URL customization

---

## Phase 5: Operational Maturity

### Documentation
- [ ] Write user-facing docs site (setup, usage, FAQ, troubleshooting)
- [ ] Write API reference (OpenAPI/Swagger spec auto-generated from NestJS decorators)
- [ ] Write deployment guides for common platforms (Railway, Fly.io, AWS, DigitalOcean)
- [ ] Write backup and disaster recovery runbook
- [ ] Write incident response playbook

### Developer Experience
- [ ] Add OpenAPI/Swagger decorators to all endpoints
- [ ] Add seed script for local development (sample workspaces, users, mappings)
- [ ] Add `docker compose` profile for local dev with hot reload
- [ ] Improve error messages (user-facing errors should be helpful, not stack traces)
- [ ] Add request validation pipes with clear error responses

### Release Process
- [ ] Set up semantic-release for automated versioning and changelogs
- [ ] Add feature flags system (LaunchDarkly, Unleash, or simple DB-backed flags)
- [ ] Implement blue-green or canary deployment strategy
- [ ] Add rollback procedure documentation and tooling

---

## Current State Summary

| Area | Status | Priority |
|------|--------|----------|
| Auth & Multi-tenancy | Production-ready | - |
| Database Schema | Solid | - |
| Admin Dashboard | Functional | - |
| Payment Model & Billing | Not started (detailed plan added) | P0 |
| CI/CD | Git hooks only | P0 |
| Tests | 1 E2E test | P0 |
| Rate Limiting | None | P0 |
| Encryption at Rest | None | P1 |
| Audit Logging | None | P1 |
| Monitoring | App logs only | P1 |
| PostgreSQL Migration | SQLite in prod | P2 |
| User Dashboard | Admin-only | P2 |
| Documentation | Dev-focused | P3 |
