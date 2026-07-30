const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/finance/invoices/generate
// Builds an invoice for one student from the matching fee_structures
// (by class + academic year + term) and applies any student_discounts
// as negative line items. Body:
// { student_id, academic_year_id, term_id?, due_date? }
// ------------------------------------------------------------
async function generateInvoice(req, res, next) {
  try {
    const { schoolId } = req;
    const { student_id, academic_year_id, term_id, due_date } = req.body;

    if (!student_id || !academic_year_id) {
      throw new ApiError(400, 'student_id and academic_year_id are required');
    }

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, class_id')
      .eq('school_id', schoolId)
      .eq('id', student_id)
      .single();
    if (studentError) throw new ApiError(404, 'Student not found');

    let structureQuery = supabase
      .from('fee_structures')
      .select('id, fee_category_id, amount, class_id')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academic_year_id);
    structureQuery = term_id ? structureQuery.eq('term_id', term_id) : structureQuery.is('term_id', null);

    const { data: structures, error: structError } = await structureQuery;
    if (structError) throw new ApiError(400, structError.message);

    const applicable = (structures || []).filter(
      (s) => s.class_id === null || s.class_id === student.class_id
    );

    if (applicable.length === 0) {
      throw new ApiError(400, 'No matching fee structure found for this student/class/term/year');
    }

    const { data: discounts, error: discError } = await supabase
      .from('student_discounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('student_id', student_id)
      .eq('academic_year_id', academic_year_id);
    if (discError) throw new ApiError(400, discError.message);

    // fee category names for readable line item descriptions
    const categoryIds = [...new Set(applicable.map((s) => s.fee_category_id))];
    const { data: categories } = await supabase
      .from('fee_categories')
      .select('id, name')
      .in('id', categoryIds);
    const categoryName = Object.fromEntries((categories || []).map((c) => [c.id, c.name]));

    const items = applicable.map((s) => ({
      fee_category_id: s.fee_category_id,
      description: categoryName[s.fee_category_id] || 'Fee',
      amount: s.amount,
    }));

    for (const d of discounts || []) {
      const targetItems = d.fee_category_id
        ? items.filter((i) => i.fee_category_id === d.fee_category_id)
        : [{ amount: items.reduce((sum, i) => sum + Number(i.amount), 0) }]; // whole-invoice base

      const base = targetItems.reduce((sum, i) => sum + Number(i.amount), 0);
      const discountAmount = d.discount_type === 'percentage' ? (base * Number(d.value)) / 100 : Number(d.value);

      items.push({
        fee_category_id: d.fee_category_id,
        description: `Discount: ${d.reason || d.discount_type}`,
        amount: -Math.min(discountAmount, base),
      });
    }

    const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        school_id: schoolId,
        student_id,
        academic_year_id,
        term_id: term_id || null,
        total_amount: totalAmount,
        due_date: due_date || null,
        status: 'pending',
      })
      .select()
      .single();
    if (invoiceError) throw new ApiError(400, invoiceError.message);

    const itemRows = items.map((i) => ({ ...i, invoice_id: invoice.id }));
    const { error: itemsError } = await supabase.from('invoice_items').insert(itemRows);
    if (itemsError) throw new ApiError(400, itemsError.message);

    res.status(201).json({ data: { ...invoice, items } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/finance/invoices
// Filters: student_id, status, academic_year_id, term_id
// ------------------------------------------------------------
async function listInvoices(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('invoices')
      .select('*, students(first_name, last_name, admission_number)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.academic_year_id) query = query.eq('academic_year_id', req.query.academic_year_id);
    if (req.query.term_id) query = query.eq('term_id', req.query.term_id);

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    res.json({ data, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/finance/invoices/:id
// ------------------------------------------------------------
async function getInvoice(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('invoices')
      .select(
        `*, students(first_name, last_name, admission_number),
         invoice_items(*),
         payments(*)`
      )
      .eq('school_id', schoolId)
      .eq('id', req.params.id)
      .single();

    if (error) throw new ApiError(404, 'Invoice not found');
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/finance/invoices/:id  (manual status/due_date correction)
// ------------------------------------------------------------
async function updateInvoice(req, res, next) {
  try {
    const { schoolId } = req;
    const allowedFields = ['status', 'due_date'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('invoices')
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
// GET /api/finance/students/:studentId/balance
// Sum of total_amount - amount_paid across a student's invoices.
// ------------------------------------------------------------
async function studentBalance(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('invoices')
      .select('total_amount, amount_paid, status')
      .eq('school_id', schoolId)
      .eq('student_id', req.params.studentId);
    if (req.query.academic_year_id) query = query.eq('academic_year_id', req.query.academic_year_id);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);

    const totalInvoiced = data.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const totalPaid = data.reduce((sum, i) => sum + Number(i.amount_paid), 0);

    res.json({
      data: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        outstanding: totalInvoiced - totalPaid,
        invoice_count: data.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/finance/reports/summary
// Filters: academic_year_id, term_id, class_id (via students join)
// ------------------------------------------------------------
async function financialSummary(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase.from('invoices').select('total_amount, amount_paid, status, students!inner(class_id)').eq(
      'school_id',
      schoolId
    );

    if (req.query.academic_year_id) query = query.eq('academic_year_id', req.query.academic_year_id);
    if (req.query.term_id) query = query.eq('term_id', req.query.term_id);
    if (req.query.class_id) query = query.eq('students.class_id', req.query.class_id);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);

    const totalInvoiced = data.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const totalCollected = data.reduce((sum, i) => sum + Number(i.amount_paid), 0);

    res.json({
      data: {
        total_invoiced: totalInvoiced,
        total_collected: totalCollected,
        total_outstanding: totalInvoiced - totalCollected,
        invoice_count: data.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateInvoice,
  listInvoices,
  getInvoice,
  updateInvoice,
  studentBalance,
  financialSummary,
};