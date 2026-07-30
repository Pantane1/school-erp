const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// GET /api/students
// Supports: pagination (page, limit), search (q), filters (status, class_id)
// ------------------------------------------------------------
async function listStudents(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('students')
      .select('*, classes(name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('last_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.class_id) {
      query = query.eq('class_id', req.query.class_id);
    }
    if (req.query.q) {
      query = query.or(
        `first_name.ilike.%${req.query.q}%,last_name.ilike.%${req.query.q}%,admission_number.ilike.%${req.query.q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    res.json({
      data,
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/students/:id
// ------------------------------------------------------------
async function getStudent(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('students')
      .select(
        `*, classes(name),
         student_guardians(is_primary_contact, guardians(*)),
         student_emergency_contacts(*),
         student_medical_records(*),
         student_documents(*)`
      )
      .eq('school_id', schoolId)
      .eq('id', req.params.id)
      .is('deleted_at', null)
      .single();

    if (error) throw new ApiError(404, 'Student not found');
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/students  (admission)
// ------------------------------------------------------------
async function createStudent(req, res, next) {
  try {
    const { schoolId } = req;
    const {
      admission_number,
      first_name,
      last_name,
      date_of_birth,
      gender,
      class_id,
      academic_year_id,
      admission_date,
      address,
      photo_url,
      guardians, // optional array: [{ full_name, relationship, phone, email, is_primary_contact }]
    } = req.body;

    if (!admission_number || !first_name || !last_name) {
      throw new ApiError(400, 'admission_number, first_name and last_name are required');
    }

    const { data: student, error } = await supabase
      .from('students')
      .insert({
        school_id: schoolId,
        admission_number,
        first_name,
        last_name,
        date_of_birth,
        gender,
        class_id,
        academic_year_id,
        admission_date,
        address,
        photo_url,
      })
      .select()
      .single();

    if (error) throw new ApiError(400, error.message);

    if (Array.isArray(guardians) && guardians.length > 0) {
      for (const g of guardians) {
        const { data: guardian, error: gErr } = await supabase
          .from('guardians')
          .insert({
            school_id: schoolId,
            full_name: g.full_name,
            relationship: g.relationship,
            phone: g.phone,
            email: g.email,
            occupation: g.occupation,
          })
          .select()
          .single();
        if (gErr) throw new ApiError(400, gErr.message);

        await supabase.from('student_guardians').insert({
          student_id: student.id,
          guardian_id: guardian.id,
          is_primary_contact: !!g.is_primary_contact,
        });
      }
    }

    res.status(201).json({ data: student });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/students/:id
// ------------------------------------------------------------
async function updateStudent(req, res, next) {
  try {
    const { schoolId } = req;
    const allowedFields = [
      'first_name', 'last_name', 'date_of_birth', 'gender', 'class_id',
      'academic_year_id', 'status', 'photo_url', 'address',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('students')
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
// DELETE /api/students/:id  (soft delete)
// ------------------------------------------------------------
async function deleteStudent(req, res, next) {
  try {
    const { schoolId } = req;
    const { error } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('school_id', schoolId)
      .eq('id', req.params.id);

    if (error) throw new ApiError(400, error.message);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/students/bulk-import
// Body: { students: [ { admission_number, first_name, last_name, ... } ] }
// ------------------------------------------------------------
async function bulkImportStudents(req, res, next) {
  try {
    const { schoolId } = req;
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      throw new ApiError(400, 'students array is required');
    }

    const rows = students.map((s) => ({ ...s, school_id: schoolId }));
    const { data, error } = await supabase.from('students').insert(rows).select();

    if (error) throw new ApiError(400, error.message);
    res.status(201).json({ data, imported: data.length });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/students/export  (returns JSON; convert to CSV client-side or add csv lib later)
// ------------------------------------------------------------
async function exportStudents(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('students')
      .select('*, classes(name)')
      .eq('school_id', schoolId)
      .is('deleted_at', null);

    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkImportStudents,
  exportStudents,
};
