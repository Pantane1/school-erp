const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { createCrudController } = require('../utils/crudFactory');

const base = createCrudController('terms', {
  allowedFields: ['name', 'academic_year_id', 'start_date', 'end_date'],
  selectQuery: '*, academic_years(name)',
  orderBy: 'start_date',
});

// POST /api/terms/:id/set-current
// Unsets any other current term within the same academic year, then sets this one.
async function setCurrent(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { data: term, error: fetchError } = await supabase
      .from('terms')
      .select('academic_year_id')
      .eq('school_id', schoolId)
      .eq('id', id)
      .single();
    if (fetchError) throw new ApiError(404, 'Term not found');

    const { error: unsetError } = await supabase
      .from('terms')
      .update({ is_current: false })
      .eq('school_id', schoolId)
      .eq('academic_year_id', term.academic_year_id)
      .eq('is_current', true);
    if (unsetError) throw new ApiError(400, unsetError.message);

    const { data, error } = await supabase
      .from('terms')
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