/**
 * Tenant context middleware.
 *
 * TEMPORARY: login/auth hasn't been built yet, so there's no JWT to pull
 * school_id from. Until then, every request must carry an `x-school-id`
 * header identifying the tenant. This keeps the app-layer tenant scoping
 * pattern in place now, so switching to
 * `req.school_id = req.auth.school_id` (from a verified JWT) later is a
 * one-line change everywhere else in the codebase.
 *
 * DO NOT ship this to production without real auth — the header is
 * trivially spoofable. It exists to unblock Student Management dev now.
 */
function tenantContext(req, res, next) {
  const schoolId = req.header('x-school-id');

  if (!schoolId) {
    return res.status(400).json({
      error: 'Missing x-school-id header. (Temporary stand-in until auth/login is implemented.)',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(schoolId)) {
    return res.status(400).json({ error: 'x-school-id must be a valid UUID' });
  }

  req.schoolId = schoolId;
  next();
}

module.exports = tenantContext;
