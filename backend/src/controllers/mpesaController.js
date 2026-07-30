const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');
const { initiateStkPush } = require('../utils/mpesaService');
const { applyPaymentToInvoice } = require('./paymentController');

// ------------------------------------------------------------
// POST /api/finance/payments/mpesa/initiate
// Body: { student_id, invoice_id?, amount, phone, account_reference? }
// Creates a 'pending' payment row, sends the STK push, and stores the
// CheckoutRequestID so the callback can find and complete it.
// ------------------------------------------------------------
async function initiate(req, res, next) {
  try {
    const { schoolId } = req;
    const { student_id, invoice_id, amount, phone, account_reference } = req.body;

    if (!student_id || !amount || !phone) {
      throw new ApiError(400, 'student_id, amount and phone are required');
    }

    const stkResponse = await initiateStkPush({
      phone,
      amount,
      accountReference: account_reference || student_id,
      transactionDesc: 'School fees payment',
    });

    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        school_id: schoolId,
        student_id,
        invoice_id: invoice_id || null,
        amount,
        method: 'mpesa',
        status: 'pending',
        mpesa_checkout_request_id: stkResponse.CheckoutRequestID,
      })
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    res.status(202).json({
      data: payment,
      mpesa: { checkoutRequestId: stkResponse.CheckoutRequestID, customerMessage: stkResponse.CustomerMessage },
    });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/finance/payments/mpesa/callback
// Public endpoint Safaricom's Daraja API POSTs to. No tenant header
// available here — the school is resolved from the stored payment row
// via CheckoutRequestID, not from x-school-id. NOT behind tenantContext
// middleware — see routes/mpesaRoutes.js.
// ------------------------------------------------------------
async function callback(req, res, next) {
  try {
    const stkCallback = req.body?.Body?.stkCallback;
    if (!stkCallback) return res.status(400).json({ ResultCode: 1, ResultDesc: 'Malformed callback' });

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;

    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('mpesa_checkout_request_id', checkoutRequestId)
      .single();

    if (findError || !payment) {
      // Acknowledge anyway — Safaricom retries on non-200 responses.
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted (no matching payment)' });
    }

    if (resultCode !== 0) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const items = stkCallback.CallbackMetadata?.Item || [];
    const get = (name) => items.find((i) => i.Name === name)?.Value;

    await supabase
      .from('payments')
      .update({
        status: 'completed',
        mpesa_receipt_number: get('MpesaReceiptNumber'),
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (payment.invoice_id) await applyPaymentToInvoice(payment.invoice_id);

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiate, callback };