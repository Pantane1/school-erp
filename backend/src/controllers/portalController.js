const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// Shared: relevant announcements for a given audience + optional class
// ------------------------------------------------------------
async function relevantAnnouncements(schoolId, audience, classId) {
  let query = supabase
    .from('announcements')
    .select('*')
    .eq('school_id', schoolId)
    .in('audience', ['all', audience])
    .order('published_at', { ascending: false })
    .limit(10);

  const { data, error } = await query;
  if (error) return [];

  // class-specific announcements only show to that class; school-wide (class_id null) show to everyone
  return (data || []).filter((a) => a.class_id === null || a.class_id === classId);
}

// ------------------------------------------------------------
// GET /api/portal/students/:studentId
// One-call dashboard: profile, attendance summary, fee balance,
// latest exam results, relevant announcements.
// Used for both the student portal and the parent portal (a parent
// views the same data for their child).
// ------------------------------------------------------------
async function studentDashboard(req, res, next) {
  try {
    const { schoolId } = req;
    const { studentId } = req.params;

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, classes(id, name)')
      .eq('school_id', schoolId)
      .eq('id', studentId)
      .single();
    if (studentError) throw new ApiError(404, 'Student not found');

    // Attendance summary — last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: attendanceRows } = await supabase
      .from('student_attendance')
      .select('status')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .gte('attendance_date', since.toISOString().slice(0, 10));

    const attendanceSummary = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const row of attendanceRows || []) attendanceSummary[row.status] = (attendanceSummary[row.status] || 0) + 1;

    // Fee balance across all invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total_amount, amount_paid, status, due_date')
      .eq('school_id', schoolId)
      .eq('student_id', studentId);

    const totalInvoiced = (invoices || []).reduce((sum, i) => sum + Number(i.total_amount), 0);
    const totalPaid = (invoices || []).reduce((sum, i) => sum + Number(i.amount_paid), 0);

    // Most recent marks entered for this student
    const { data: recentMarks } = await supabase
      .from('marks')
      .select('marks_obtained, grade, exam_subjects(subject_id, exam_id, subjects(name))')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5);

    const announcements = await relevantAnnouncements(schoolId, 'students', student.classes?.id);

    res.json({
      data: {
        student: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          admission_number: student.admission_number,
          class: student.classes?.name,
          status: student.status,
        },
        attendance_last_30_days: attendanceSummary,
        fees: {
          total_invoiced: totalInvoiced,
          total_paid: totalPaid,
          outstanding: totalInvoiced - totalPaid,
        },
        recent_marks: recentMarks || [],
        announcements,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/portal/teachers/:teacherId
// Dashboard: assigned classes/subjects, today's attendance-marking
// status per class, relevant announcements.
// ------------------------------------------------------------
async function teacherDashboard(req, res, next) {
  try {
    const { schoolId } = req;
    const { teacherId } = req.params;

    const { data: assignments, error: assignError } = await supabase
      .from('class_subjects')
      .select('id, classes(id, name), subjects(name)')
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId);
    if (assignError) throw new ApiError(400, assignError.message);

    const today = new Date().toISOString().slice(0, 10);
    const classIds = [...new Set((assignments || []).map((a) => a.classes?.id).filter(Boolean))];

    let attendanceToday = [];
    if (classIds.length > 0) {
      const { data } = await supabase
        .from('student_attendance')
        .select('class_id')
        .eq('school_id', schoolId)
        .eq('attendance_date', today)
        .in('class_id', classIds);
      const markedClassIds = new Set((data || []).map((r) => r.class_id));
      attendanceToday = classIds.map((id) => ({
        class_id: id,
        marked_today: markedClassIds.has(id),
      }));
    }

    const announcements = await relevantAnnouncements(schoolId, 'teachers', null);

    res.json({
      data: {
        teacher_id: teacherId,
        assignments: assignments || [],
        attendance_today: attendanceToday,
        announcements,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { studentDashboard, teacherDashboard };