const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

const FINE_PER_DAY = Number(process.env.LIBRARY_FINE_PER_DAY || 10);
const DEFAULT_LOAN_DAYS = 14;

// ------------------------------------------------------------
// POST /api/library/borrowings
// Body: { book_id, student_id? , borrower_user_id?, due_date? }
// Decrements available_copies; fails if none available.
// ------------------------------------------------------------
async function borrow(req, res, next) {
  try {
    const { schoolId } = req;
    const { book_id, student_id, borrower_user_id, due_date } = req.body;

    if (!book_id || (!student_id && !borrower_user_id)) {
      throw new ApiError(400, 'book_id and either student_id or borrower_user_id are required');
    }

    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, available_copies')
      .eq('school_id', schoolId)
      .eq('id', book_id)
      .single();
    if (bookError) throw new ApiError(404, 'Book not found');
    if (book.available_copies < 1) throw new ApiError(400, 'No copies available to borrow');

    const computedDueDate =
      due_date || new Date(Date.now() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: borrowing, error: borrowError } = await supabase
      .from('book_borrowings')
      .insert({
        school_id: schoolId,
        book_id,
        student_id: student_id || null,
        borrower_user_id: borrower_user_id || null,
        due_date: computedDueDate,
        status: 'borrowed',
      })
      .select()
      .single();
    if (borrowError) throw new ApiError(400, borrowError.message);

    await supabase
      .from('books')
      .update({ available_copies: book.available_copies - 1 })
      .eq('id', book_id);

    res.status(201).json({ data: borrowing });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/library/borrowings/:id/return
// Marks a borrowing returned, computes a fine if overdue, restores
// available_copies.
// ------------------------------------------------------------
async function returnBook(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { data: borrowing, error: findError } = await supabase
      .from('book_borrowings')
      .select('id, book_id, due_date, status')
      .eq('school_id', schoolId)
      .eq('id', id)
      .single();
    if (findError) throw new ApiError(404, 'Borrowing record not found');
    if (borrowing.status === 'returned') throw new ApiError(400, 'This book was already returned');

    const today = new Date();
    const due = new Date(borrowing.due_date);
    const daysLate = Math.max(0, Math.ceil((today - due) / (24 * 60 * 60 * 1000)));
    const fine = daysLate * FINE_PER_DAY;

    const { data: updated, error: updateError } = await supabase
      .from('book_borrowings')
      .update({
        returned_date: today.toISOString().slice(0, 10),
        fine_amount: fine,
        status: 'returned',
      })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw new ApiError(400, updateError.message);

    const { data: book } = await supabase.from('books').select('available_copies').eq('id', borrowing.book_id).single();
    if (book) {
      await supabase
        .from('books')
        .update({ available_copies: book.available_copies + 1 })
        .eq('id', borrowing.book_id);
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/library/borrowings
// Filters: status, book_id, student_id, borrower_user_id
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('book_borrowings')
      .select('*, books(title, author), students(first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .order('borrowed_date', { ascending: false });

    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.book_id) query = query.eq('book_id', req.query.book_id);
    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
    if (req.query.borrower_user_id) query = query.eq('borrower_user_id', req.query.borrower_user_id);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/library/overdue
// Everything still 'borrowed' past its due_date.
// ------------------------------------------------------------
async function overdue(req, res, next) {
  try {
    const { schoolId } = req;
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('book_borrowings')
      .select('*, books(title, author), students(first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .eq('status', 'borrowed')
      .lt('due_date', today);

    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { borrow, returnBook, list, overdue };