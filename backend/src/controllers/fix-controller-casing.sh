#!/bin/bash
# Run this from ~/Downloads/school-erp/backend/src/controllers
set -e

echo "Removing wrongly-cased duplicate files..."
rm -f borrowingcontroller.js
rm -f employeecontroller.js
rm -f hostelallocationcontroller.js
rm -f hostelroomcontroller.js
rm -f hostelvisitorcontroller.js
rm -f leavecontroller.js
rm -f Payrollcontroller.js
rm -f "Pickuppointcontroller .js"
rm -f studenttransportcontroller.js
rm -f transportroutecontroller.js
rm -f transportvehiclecontroller.js

echo "Recreating each with correct name + content..."
cat > borrowingController.js << 'FILE_EOF'
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
FILE_EOF

cat > employeeController.js << 'FILE_EOF'
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// GET /api/hr/employees
// Lists users with their roles + employment fields.
// Filters: department_id, employment_status, role
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('*, departments(name), user_roles(roles(name))', { count: 'exact' })
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (req.query.department_id) query = query.eq('department_id', req.query.department_id);
    if (req.query.employment_status) query = query.eq('employment_status', req.query.employment_status);

    const { data, error, count } = await query;
    if (error) throw new ApiError(400, error.message);

    let results = data;
    if (req.query.role) {
      results = data.filter((u) => (u.user_roles || []).some((ur) => ur.roles?.name === req.query.role));
    }

    res.json({ data: results, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/hr/employees/:id
// ------------------------------------------------------------
async function getOne(req, res, next) {
  try {
    const { schoolId } = req;
    const { data, error } = await supabase
      .from('users')
      .select('*, departments(name), user_roles(roles(name))')
      .eq('school_id', schoolId)
      .eq('id', req.params.id)
      .single();

    if (error) throw new ApiError(404, 'Employee not found');
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// PATCH /api/hr/employees/:id
// Employment-profile fields only — not identity/auth fields (those
// belong to /api/auth/*).
// ------------------------------------------------------------
async function update(req, res, next) {
  try {
    const { schoolId } = req;
    const allowedFields = ['job_title', 'department_id', 'employment_date', 'employment_status', 'phone'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('users')
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

module.exports = { list, getOne, update };
FILE_EOF

cat > hostelAllocationController.js << 'FILE_EOF'
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/hostel/allocations
// Body: { room_id, student_id }
// Fails if the room is at capacity or the student already has an
// active allocation elsewhere.
// ------------------------------------------------------------
async function allocate(req, res, next) {
  try {
    const { schoolId } = req;
    const { room_id, student_id } = req.body;
    if (!room_id || !student_id) throw new ApiError(400, 'room_id and student_id are required');

    const { data: room, error: roomError } = await supabase
      .from('hostel_rooms')
      .select('id, capacity, occupied_count')
      .eq('school_id', schoolId)
      .eq('id', room_id)
      .single();
    if (roomError) throw new ApiError(404, 'Room not found');
    if (room.occupied_count >= room.capacity) throw new ApiError(400, 'Room is at full capacity');

    const { data: allocation, error: allocError } = await supabase
      .from('hostel_allocations')
      .insert({ school_id: schoolId, room_id, student_id, status: 'active' })
      .select()
      .single();
    if (allocError) {
      if (allocError.code === '23505') throw new ApiError(409, 'This student already has an active hostel allocation');
      throw new ApiError(400, allocError.message);
    }

    await supabase.from('hostel_rooms').update({ occupied_count: room.occupied_count + 1 }).eq('id', room_id);

    res.status(201).json({ data: allocation });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/hostel/allocations/:id/vacate
// ------------------------------------------------------------
async function vacate(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const { data: allocation, error: findError } = await supabase
      .from('hostel_allocations')
      .select('id, room_id, status')
      .eq('school_id', schoolId)
      .eq('id', id)
      .single();
    if (findError) throw new ApiError(404, 'Allocation not found');
    if (allocation.status === 'vacated') throw new ApiError(400, 'Already vacated');

    const { data: updated, error: updateError } = await supabase
      .from('hostel_allocations')
      .update({ status: 'vacated', vacated_date: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .select()
      .single();
    if (updateError) throw new ApiError(400, updateError.message);

    const { data: room } = await supabase
      .from('hostel_rooms')
      .select('occupied_count')
      .eq('id', allocation.room_id)
      .single();
    if (room) {
      await supabase
        .from('hostel_rooms')
        .update({ occupied_count: Math.max(0, room.occupied_count - 1) })
        .eq('id', allocation.room_id);
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/hostel/allocations
// Filters: room_id, student_id, status
// ------------------------------------------------------------
async function listAllocations(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('hostel_allocations')
      .select('*, hostel_rooms(block_name, room_number), students(first_name, last_name, admission_number)')
      .eq('school_id', schoolId)
      .order('allocated_date', { ascending: false });

    if (req.query.room_id) query = query.eq('room_id', req.query.room_id);
    if (req.query.student_id) query = query.eq('student_id', req.query.student_id);
    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

module.exports = { allocate, vacate, listAllocations };
FILE_EOF

cat > hostelRoomController.js << 'FILE_EOF'
const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('hostel_rooms', {
  allowedFields: ['block_name', 'room_number', 'capacity'],
  orderBy: 'block_name',
});
FILE_EOF

cat > hostelVisitorController.js << 'FILE_EOF'
const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('hostel_visitors', {
  allowedFields: ['student_id', 'visitor_name', 'relationship', 'purpose', 'check_in_time', 'check_out_time'],
  selectQuery: '*, students(first_name, last_name, admission_number)',
  orderBy: 'check_in_time',
});
FILE_EOF

cat > leaveController.js << 'FILE_EOF'
const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

// ------------------------------------------------------------
// POST /api/hr/leave-requests
// Body: { user_id, leave_type, start_date, end_date, reason? }
// ------------------------------------------------------------
async function create(req, res, next) {
  try {
    const { schoolId } = req;
    const { user_id, leave_type, start_date, end_date, reason } = req.body;

    if (!user_id || !leave_type || !start_date || !end_date) {
      throw new ApiError(400, 'user_id, leave_type, start_date and end_date are required');
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({ school_id: schoolId, user_id, leave_type, start_date, end_date, reason: reason || null })
      .select()
      .single();
    if (error) throw new ApiError(400, error.message);

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// GET /api/hr/leave-requests
// Filters: user_id, status, leave_type
// ------------------------------------------------------------
async function list(req, res, next) {
  try {
    const { schoolId } = req;
    let query = supabase
      .from('leave_requests')
      .select('*, users(full_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (req.query.user_id) query = query.eq('user_id', req.query.user_id);
    if (req.query.status) query = query.eq('status', req.query.status);
    if (req.query.leave_type) query = query.eq('leave_type', req.query.leave_type);

    const { data, error } = await query;
    if (error) throw new ApiError(400, error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

// ------------------------------------------------------------
// POST /api/hr/leave-requests/:id/decide
// Body: { status: 'approved' | 'rejected', approved_by? }
// ------------------------------------------------------------
async function decide(req, res, next) {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const { status, approved_by } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      throw new ApiError(400, "status must be 'approved' or 'rejected'");
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status, approved_by: approved_by || null })
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

module.exports = { create, list, decide };
FILE_EOF

cat > payrollController.js << 'FILE_EOF'
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
FILE_EOF

cat > studentTransportController.js << 'FILE_EOF'
const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('student_transport', {
  allowedFields: ['student_id', 'route_id', 'pickup_point_id'],
  selectQuery: '*, students(first_name, last_name, admission_number), transport_routes(name), transport_pickup_points(name)',
  orderBy: 'created_at',
});
FILE_EOF

cat > transportRouteController.js << 'FILE_EOF'
const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('transport_routes', {
  allowedFields: ['name', 'vehicle_id'],
  selectQuery: '*, transport_vehicles(registration_number, driver_name)',
  orderBy: 'name',
});
FILE_EOF

cat > transportVehicleController.js << 'FILE_EOF'
const { createCrudController } = require('../utils/crudFactory');

module.exports = createCrudController('transport_vehicles', {
  allowedFields: ['registration_number', 'capacity', 'driver_name', 'driver_phone'],
  orderBy: 'registration_number',
});
FILE_EOF

echo ""
echo "Done. Verifying final state:"
ls | grep -iE "book|borrow|hostel|transport|pickup|employee|leave|payroll"
