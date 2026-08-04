const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/hr/leave-requests
// Body: { user_id, leave_type, start_date, end_date, reason? }
// ------------------------------------------------------------
async function create(req, res, next) {
  try {
    const { schoolId } = req;
    const { user_id, leave_type, start_date, end_date, reason } = req.body;

    if (!user_id || !leave_type || !start_date || !end_date) {
      throw new ApiError(400, 'user_id, leave_type, start_date and end_date are required');
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({ school_id: schoolId, user_id, leave_type, start_date, end_date, reason: reason || null })
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/hr/leave-requests
// Filters: user_id, status, leave_type
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('leave_requests')
      .select('*, users(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.leave_type) query = query.eq('leave_type', req.query.leave_type);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/hr/leave-requests/:id/decide
// Body: { status: 'approved' | 'rejected', approved_by? }
// ------------------------------------------------------------
async function decide(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { status, approved_by } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      throw new ApiError(400, "status must be 'approved' or 'rejected'");
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status, approved_by: approved_by || null })
      .eq('school_id', schoolId)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, decide };
