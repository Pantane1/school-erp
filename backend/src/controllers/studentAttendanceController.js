const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/attendance/students/bulk
// Mark a whole class's attendance for one day in a single call.
// Body: { class_id, term_id?, attendance_date, records: [{ student_id, status, notes? }] }
// Upserts on (student_id, attendance_date) — re-marking a day overwrites it.
// ------------------------------------------------------------
async function markBulk(req, res, next) {
  try {
    const { schoolId } = req;
    const { class_id, term_id, attendance_date, records, marked_by } = req.body;

    if (!class_id || !attendance_date || !Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'class_id, attendance_date and a non-empty records array are required');
    }

    const rows = records.map((r) => ({
      school_id: schoolId,
      student_id: r.student_id,
      class_id,
      term_id: term_id || null,
      attendance_date,
      status: r.status || 'present',
      notes: r.notes || null,
      marked_by: marked_by || null,
    }));

    const { data, error } = await supabase
      .from('student_attendance')
      .upsert(rows, { onConflict: 'student_id,attendance_date' })
      .select();

    if (error) throw new ApiError(400, error.message);
    res.status(201).json({ data, marked: data.length });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/attendance/students
// Filters: class_id, student_id, date (single day), from & to (range), status
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('student_attendance')
      .select('*, students(first_name, last_name, admission_number), classes(name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('attendance_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.class_id) query = query.eq('class_id', req.query.class_id);
    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
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
// PATCH /api/attendance/students/:id
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
      .from('student_attendance')
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
// DELETE /api/attendance/students/:id
// ------------------------------------------------------------
async function remove(req, res, next) {
  try {
    const { schoolId } = req;
    const { error } = await supabase
      .from('student_attendance')
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
// GET /api/attendance/students/summary
// Filters: student_id (required) or class_id, plus from/to date range.
// Returns counts per status.
// ------------------------------------------------------------
async function summary(req, res, next) {
  try {
    const { schoolId } = req;
    const { student_id, class_id, from, to } = req.query;

    if (!student_id && !class_id) {
      throw new ApiError(400, 'student_id or class_id is required');
    }

    let query = supabase.from('student_attendance').select('status').eq('school_id', schoolId);
    if (student_id) query = query.eq('student_id', student_id);
    if (class_id) query = query.eq('class_id', class_id);
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

module.exports = { markBulk, list, update, remove, summary };