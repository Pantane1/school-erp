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
