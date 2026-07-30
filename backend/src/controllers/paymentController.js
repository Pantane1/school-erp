const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// Shared: apply a completed payment's amount to its invoice
// (amount_paid + status). Used by both manual recording and the
// M-Pesa callback handler.
// ------------------------------------------------------------
async function applyPaymentToInvoice(invoiceId) {
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('id, total_amount')
    .eq('id', invoiceId)
    .single();
  if (invError) return;

  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('amount')
    .eq('invoice_id', invoiceId)
    .eq('status', 'completed');
  if (payError) return;

  const amountPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const status = amountPaid >= Number(invoice.total_amount) ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

  await supabase.from('invoices').update({ amount_paid: amountPaid, status }).eq('id', invoiceId);
}

// ------------------------------------------------------------
// POST /api/finance/payments
// Records a manual payment (cash, bank, cheque, or an already-confirmed
// M-Pesa transaction). For live M-Pesa STK push, use
// /api/finance/payments/mpesa/initiate instead — that flow creates the
// payment record itself once Safaricom's callback confirms it.
// Body: { student_id, invoice_id?, amount, method, reference?, recorded_by? }
// ------------------------------------------------------------
async function recordPayment(req, res, next) {
  try {
    const { schoolId } = req;
    const { student_id, invoice_id, amount, method, reference, recorded_by } = req.body;

    if (!student_id || !amount || !method) {
      throw new ApiError(400, 'student_id, amount and method are required');
    }

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id,
        invoice_id: invoice_id || null,
        amount,
        method,
        reference: reference || null,
        status: 'completed',
        recorded_by: recorded_by || null,
      })
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    if (invoice_id) await applyPaymentToInvoice(invoice_id);

    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/finance/payments
// Filters: student_id, invoice_id, method, status, from, to
// ------------------------------------------------------------
async function listPayments(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('payments')
      .select('*, students(first_name, last_name, admission_number)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('paid_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
    if (req.query.invoice_id) query = query.eq('invoice_id', req.query.invoice_id);
    if (req.query.method) query = query.eq('method', req.query.method);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.from) query = query.gte('paid_at', req.query.from);
    if (req.query.to) query = query.lte('paid_at', req.query.to);

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    res.json({ data, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordPayment, listPayments, applyPaymentToInvoice };