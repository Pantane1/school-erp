const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// Resolve a grade + grade_point for a score against the school's
// grading_scales. Returns { grade: null, grade_point: null } if no
// scale matches (e.g. grading_scales not configured yet).
// ------------------------------------------------------------
async function resolveGrade(schoolId, score) {
  const { data: scales } = await supabase
    .from('grading_scales')
    .select('grade, min_score, max_score, grade_point')
    .eq('school_id', schoolId);

  const match = (scales || []).find((s) => score >= Number(s.min_score) && score <= Number(s.max_score));
  return match ? { grade: match.grade, grade_point: match.grade_point } : { grade: null, grade_point: null };
}

// ------------------------------------------------------------
// POST /api/exams/marks/bulk
// Enter/replace marks for every student in one exam_subject (one class's
// paper for one subject) in a single call, auto-grading each score.
// Body: { exam_subject_id, records: [{ student_id, marks_obtained, remarks? }], entered_by? }
// ------------------------------------------------------------
async function bulkEnterMarks(req, res, next) {
  try {
    const { schoolId } = req;
    const { exam_subject_id, records, entered_by } = req.body;

    if (!exam_subject_id || !Array.isArray(records) || records.length === 0) {
      throw new ApiError(400, 'exam_subject_id and a non-empty records array are required');
    }

    const { data: scales } = await supabase
      .from('grading_scales')
      .select('grade, min_score, max_score, grade_point')
      .eq('school_id', schoolId);

    const gradeFor = (score) => {
      const match = (scales || []).find((s) => score >= Number(s.min_score) && score <= Number(s.max_score));
      return match ? { grade: match.grade, grade_point: match.grade_point } : { grade: null, grade_point: null };
    };

    const rows = records.map((r) => {
      const { grade, grade_point } = gradeFor(Number(r.marks_obtained));
      return {
        school_id: schoolId,
        exam_subject_id,
        student_id: r.student_id,
        marks_obtained: r.marks_obtained,
        grade,
        grade_point,
        remarks: r.remarks || null,
        entered_by: entered_by || null,
      };
    });

    const { data, error } = await supabase
      .from('marks')
      .upsert(rows, { onConflict: 'exam_subject_id,student_id' })
      .select();

    if (error) throw new ApiError(400, error.message);
    res.status(201).json({ data, entered: data.length });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/exams/marks
// Filters: exam_subject_id, student_id
// ------------------------------------------------------------
async function listMarks(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('marks')
      .select('*, students(first_name, last_name, admission_number), exam_subjects(subject_id, class_id, max_marks)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (req.query.exam_subject_id) query = query.eq('exam_subject_id', req.query.exam_subject_id);
    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/exams/marks/:id  (correct a single score/remarks, re-grades)
// ------------------------------------------------------------
async function updateMark(req, res, next) {
  try {
    const { schoolId } = req;
    const updates = {};

    if (req.body.marks_obtained !== undefined) {
      updates.marks_obtained = req.body.marks_obtained;
      const { grade, grade_point } = await resolveGrade(schoolId, Number(req.body.marks_obtained));
      updates.grade = grade;
      updates.grade_point = grade_point;
    }
    if (req.body.remarks !== undefined) updates.remarks = req.body.remarks;

    const { data, error } = await supabase
      .from('marks')
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
// GET /api/exams/:examId/report-cards/:studentId
// Aggregates every exam_subject under this exam for this student:
// per-subject score/grade, overall average, overall grade, and GPA.
// ------------------------------------------------------------
async function studentReportCard(req, res, next) {
  try {
    const { schoolId } = req;
    const { examId, studentId } = req.params;

    const { data: examSubjects, error: esError } = await supabase
      .from('exam_subjects')
      .select('id, max_marks, subjects(name)')
      .eq('school_id', schoolId)
      .eq('exam_id', examId);
    if (esError) throw new ApiError(400, esError.message);
    if (!examSubjects.length) throw new ApiError(404, 'No subjects scheduled for this exam');

    const examSubjectIds = examSubjects.map((es) => es.id);

    const { data: marks, error: marksError } = await supabase
      .from('marks')
      .select('exam_subject_id, marks_obtained, grade, grade_point')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .in('exam_subject_id', examSubjectIds);
    if (marksError) throw new ApiError(400, marksError.message);

    const bySubject = examSubjects.map((es) => {
      const m = marks.find((mk) => mk.exam_subject_id === es.id);
      return {
        subject: es.subjects?.name,
        max_marks: es.max_marks,
        marks_obtained: m?.marks_obtained ?? null,
        grade: m?.grade ?? null,
      };
    });

    const scored = marks.filter((m) => m.marks_obtained !== null);
    const average = scored.length
      ? scored.reduce((sum, m) => sum + Number(m.marks_obtained), 0) / scored.length
      : null;
    const gpa =
      scored.filter((m) => m.grade_point !== null).length > 0
        ? scored.reduce((sum, m) => sum + Number(m.grade_point || 0), 0) / scored.length
        : null;

    let overallGrade = null;
    if (average !== null) {
      overallGrade = (await resolveGrade(schoolId, average)).grade;
    }

    res.json({
      data: {
        student_id: studentId,
        exam_id: examId,
        subjects: bySubject,
        average,
        overall_grade: overallGrade,
        gpa,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/exams/:examId/rankings?class_id=
// Ranks every student in a class by their average marks across all
// subjects scheduled for this exam in that class.
// ------------------------------------------------------------
async function examRankings(req, res, next) {
  try {
    const { schoolId } = req;
    const { examId } = req.params;
    const { class_id } = req.query;

    if (!class_id) throw new ApiError(400, 'class_id is required');

    const { data: examSubjects, error: esError } = await supabase
      .from('exam_subjects')
      .select('id')
      .eq('school_id', schoolId)
      .eq('exam_id', examId)
      .eq('class_id', class_id);
    if (esError) throw new ApiError(400, esError.message);
    if (!examSubjects.length) throw new ApiError(404, 'No subjects scheduled for this exam/class');

    const examSubjectIds = examSubjects.map((es) => es.id);

    const { data: marks, error: marksError } = await supabase
      .from('marks')
      .select('student_id, marks_obtained, students(first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .in('exam_subject_id', examSubjectIds);
    if (marksError) throw new ApiError(400, marksError.message);

    const byStudent = {};
    for (const m of marks) {
      if (!byStudent[m.student_id]) {
        byStudent[m.student_id] = { student_id: m.student_id, student: m.students, total: 0, count: 0 };
      }
      byStudent[m.student_id].total += Number(m.marks_obtained);
      byStudent[m.student_id].count += 1;
    }

    const ranked = Object.values(byStudent)
      .map((s) => ({ ...s, average: s.total / s.count }))
      .sort((a, b) => b.average - a.average)
      .map((s, index) => ({ rank: index + 1, ...s }));

    res.json({ data: ranked });
  } catch (err) {
    next(err);
  }
}

module.exports = { bulkEnterMarks, listMarks, updateMark, studentReportCard, examRankings };