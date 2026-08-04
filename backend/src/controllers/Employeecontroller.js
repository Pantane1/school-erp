const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// GET /api/hr/employees
// Lists users with their roles + employment fields.
// Filters: department_id, employment_status, role
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('*, departments(name), user_roles(roles(name))', { count: 'exact' })
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (req.query.department_id) query = query.eq('department_id', req.query.department_id);
    if (req.query.employment_status) query = query.eq('employment_status', req.query.employment_status);

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    let results = data;
    if (req.query.role) {
      results = data.filter((u) => (u.user_roles || []).some((ur) => ur.roles?.name === req.query.role));
    }

    res.json({ data: results, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/hr/employees/:id
// ------------------------------------------------------------
async function getOne(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('users')
      .select('*, departments(name), user_roles(roles(name))')
      .eq('school_id', schoolId)
      .eq('id', req.params.id)
      .single();

    if (error) throw new ApiError(404, 'Employee not found');
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/hr/employees/:id
// Employment-profile fields only — not identity/auth fields (those
// belong to /api/auth/*).
// ------------------------------------------------------------
async function update(req, res, next) {
  try {
    const { schoolId } = req;
    const allowedFields = ['job_title', 'department_id', 'employment_date', 'employment_status', 'phone'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('school_id', schoolId)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, update };
