-- RLS policies for tenant isolation by org ID.
-- App code must set: SELECT set_config('app.current_org_id', '<org-id>', true);

ALTER TABLE IF EXISTS signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signature_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signature_requests_org_isolation ON signature_requests;
CREATE POLICY signature_requests_org_isolation ON signature_requests
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS signature_request_events_org_isolation ON signature_request_events;
CREATE POLICY signature_request_events_org_isolation ON signature_request_events
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS users_org_isolation ON users;
CREATE POLICY users_org_isolation ON users
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS user_roles_org_isolation ON user_roles;
CREATE POLICY user_roles_org_isolation ON user_roles
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS auth_sessions_org_isolation ON auth_sessions;
CREATE POLICY auth_sessions_org_isolation ON auth_sessions
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS auth_events_org_isolation ON auth_events;
CREATE POLICY auth_events_org_isolation ON auth_events
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

DROP POLICY IF EXISTS password_reset_tokens_org_isolation ON password_reset_tokens;
CREATE POLICY password_reset_tokens_org_isolation ON password_reset_tokens
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- Optional hardening when your app role is not table owner:
-- ALTER TABLE signature_requests FORCE ROW LEVEL SECURITY;
-- ALTER TABLE signature_request_events FORCE ROW LEVEL SECURITY;
