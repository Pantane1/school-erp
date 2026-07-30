const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/attendance/teachers
// Mark one teacher's attendance for a day (upserts on teacher_id + date)
// Body: { teacher_id, attendance_date, status?, notes?, marked_by? }
// ------------------------------------------------------------
async function mark(req, res, next) {
  try {
    const { schoolId } = req;
    const { teacher_id, attendance_date, status, notes, marked_by } = req.body;

    if (!teacher_id || !attendance_date) {
      throw new ApiError(400, 'teacher_id and attendance_date are required');
    }

    const { data, error } = await supabase
      .from('teacher_attendance')
      .upsert(
        {
          school_id: schoolId,
          teacher_id,
          attendance_date,
          status: status || 'present',
          notes: notes || null,
          marked_by: marked_by || null,
        },
        { onConflict: 'teacher_id,attendance_date' }
      )
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);
    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/attendance/teachers
// Filters: teacher_id, date, from, to, status
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('teacher_attendance')
      .select('*, teacher:users(full_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('attendance_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.teacher_id) query = query.eq('teacher_id', req.query.teacher_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.date) query = query.eq('attendance_date', req.query.date);
    if (req.query.from) query = query.gte('attendance_date', req.query.from);
    if (req.query.to) query = query.lte('attendance_date', req.query.to);

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    res.json({ data, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/attendance/teachers/:id
// ------------------------------------------------------------
async function update(req, res, next) {
  try {
    const { schoolId } = req;
    const allowedFields = ['status', 'notes'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('teacher_attendance')
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

// ------------------------------------------------------------
// DELETE /api/attendance/teachers/:id
// ------------------------------------------------------------
async function remove(req, res, next) {
  try {
    const { schoolId } = req;
    const { error } = await supabase
      .from('teacher_attendance')
      .delete()
      .eq('school_id', schoolId)
      .eq('id', req.params.id);

    if (error) throw new ApiError(400, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/attendance/teachers/summary?teacher_id=&from=&to=
// ------------------------------------------------------------
async function summary(req, res, next) {
  try {
    const { schoolId } = req;
    const { teacher_id, from, to } = req.query;

    if (!teacher_id) throw new ApiError(400, 'teacher_id is required');

    let query = supabase
      .from('teacher_attendance')
      .select('status')
      .eq('school_id', schoolId)
      .eq('teacher_id', teacher_id);
    if (from) query = query.gte('attendance_date', from);
    if (to) query = query.lte('attendance_date', to);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const row of data) counts[row.status] = (counts[row.status] || 0) + 1;

    res.json({ data: { total: data.length, ...counts } });
  } catch (err) {
    next(err);
  }
}

module.exports = { mark, list, update, remove, summary };