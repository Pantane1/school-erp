const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { createCrudController } = require('../utils/crudFactory');

const base = createCrudController('payroll_records', {
  allowedFields: ['user_id', 'pay_period', 'basic_salary', 'allowances', 'deductions'],
  selectQuery: '*, users(full_name)',
  orderBy: 'pay_period',
});

// POST /api/hr/payroll/:id/mark-paid
async function markPaid(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('payroll_records')
      .update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) })
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

module.exports = { ...base, markPaid };
