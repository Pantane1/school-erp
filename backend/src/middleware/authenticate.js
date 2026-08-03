const jwt = require('jsonwebtoken');

/**
 * Replaces the old tenantContext.js header-based stand-in now that real
 * auth exists. Verifies the Bearer token issued by POST /api/auth/login
 * or /api/auth/register-school, and sets req.userId / req.schoolId /
 * req.roles from its payload — same property names the rest of the
 * codebase already reads, so no controller changes were needed to adopt
 * this.
 */
function authenticate(req, res, next) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header. Expected: Bearer <token>' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    req.schoolId = payload.school_id;
    req.roles = payload.roles || [];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional per-route guard: requireRole('school_owner', 'principal')
 * restricts a route to users whose token carries one of the given roles.
 * Apply this to sensitive routes as you harden the system further —
 * it isn't retrofitted onto every existing route yet.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const has = (req.roles || []).some((r) => allowedRoles.includes(r));
    if (!has) {
      return res.status(403).json({ error: `Requires one of these roles: ${allowedRoles.join(', ')}` });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };