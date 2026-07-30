const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { createCrudController } = require('../utils/crudFactory');

const base = createCrudController('academic_years', {
  allowedFields: ['name', 'start_date', 'end_date'],
  orderBy: 'start_date',
});

// POST /api/academic-years/:id/set-current
// Unsets any existing current year for the school, then sets this one.
async function setCurrent(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { error: unsetError } = await supabase
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', schoolId)
      .eq('is_current', true);
    if (unsetError) throw new ApiError(400, unsetError.message);

    const { data, error } = await supabase
      .from('academic_years')
      .update({ is_current: true })
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

module.exports = { ...base, setCurrent };