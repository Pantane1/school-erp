const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

function signToken({ userId, schoolId, roles }) {
  return jwt.sign({ sub: userId, school_id: schoolId, roles }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Finds or creates a role row for this school, then links the user to it.
async function assignRole(schoolId, userId, roleName) {
  let { data: role } = await supabase
    .from('roles')
    .select('id')
    .eq('school_id', schoolId)
    .eq('name', roleName)
    .maybeSingle();

  if (!role) {
    const { data: created, error } = await supabase
      .from('roles')
      .insert({ school_id: schoolId, name: roleName })
      .select('id')
      .single();
    if (error) throw new ApiError(400, error.message);
    role = created;
  }

  await supabase.from('user_roles').insert({ user_id: userId, role_id: role.id });
}

async function rolesForUser(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId);
  return (data || []).map((r) => r.roles?.name).filter(Boolean);
}

// ------------------------------------------------------------
// POST /api/auth/register-school
// Onboards a brand-new school + its first user (the owner). Public —
// this is how a school signs up for the SaaS in the first place.
// Body: { school_name, subdomain, owner_full_name, owner_email, owner_password }
// ------------------------------------------------------------
async function registerSchool(req, res, next) {
  try {
    const { school_name, subdomain, owner_full_name, owner_email, owner_password } = req.body;

    if (!school_name || !subdomain || !owner_full_name || !owner_email || !owner_password) {
      throw new ApiError(400, 'school_name, subdomain, owner_full_name, owner_email and owner_password are required');
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({ name: school_name, subdomain })
      .select()
      .single();
    if (schoolError) throw new ApiError(400, schoolError.message);

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: owner_email,
      password: owner_password,
      email_confirm: true,
    });
    if (authError) throw new ApiError(400, authError.message);

    const { error: userError } = await supabase.from('users').insert({
      id: authUser.user.id,
      school_id: school.id,
      email: owner_email,
      full_name: owner_full_name,
    });
    if (userError) throw new ApiError(400, userError.message);

    await assignRole(school.id, authUser.user.id, 'school_owner');

    const token = signToken({ userId: authUser.user.id, schoolId: school.id, roles: ['school_owner'] });

    res.status(201).json({ data: { token, school, user: { id: authUser.user.id, email: owner_email, full_name: owner_full_name, roles: ['school_owner'] } } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/auth/register
// Creates an additional user within the AUTHENTICATED caller's school
// (a staff member, teacher, parent, etc). Protected — mounted with
// authenticate + requireRole in authRoutes.js.
// Body: { email, password, full_name, phone?, role }
// ------------------------------------------------------------
async function register(req, res, next) {
  try {
    const { schoolId } = req;
    const { email, password, full_name, phone, role } = req.body;

    if (!email || !password || !full_name || !role) {
      throw new ApiError(400, 'email, password, full_name and role are required');
    }

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw new ApiError(400, authError.message);

    const { error: userError } = await supabase.from('users').insert({
      id: authUser.user.id,
      school_id: schoolId,
      email,
      full_name,
      phone: phone || null,
    });
    if (userError) throw new ApiError(400, userError.message);

    await assignRole(schoolId, authUser.user.id, role);

    res.status(201).json({ data: { id: authUser.user.id, email, full_name, roles: [role] } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/auth/login
// Public. Verifies credentials against Supabase Auth, then issues our
// own JWT carrying school_id + roles for use as a Bearer token on
// every other /api/* route.
// Body: { email, password }
// ------------------------------------------------------------
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new ApiError(400, 'email and password are required');

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw new ApiError(401, 'Invalid email or password');

    const authUserId = signInData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, school_id, email, full_name, is_active')
      .eq('id', authUserId)
      .single();
    if (profileError) throw new ApiError(404, 'User profile not found — was this account fully registered?');

    if (!profile.is_active) throw new ApiError(403, 'This account has been deactivated');

    const roles = await rolesForUser(authUserId);
    const token = signToken({ userId: authUserId, schoolId: profile.school_id, roles });

    res.json({ data: { token, user: { ...profile, roles } } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/auth/me
// Protected. Returns the current caller's profile from their token.
// ------------------------------------------------------------
async function me(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, school_id, email, full_name, phone, is_active, schools(name, subdomain)')
      .eq('id', req.userId)
      .single();
    if (error) throw new ApiError(404, 'User not found');

    res.json({ data: { ...data, roles: req.roles } });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerSchool, register, login, me };