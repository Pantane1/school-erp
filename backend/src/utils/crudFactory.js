const supabase = require('../config/supabase');
const { ApiError } = require('../middleware/errorHandler');

/**
 * Builds a standard set of tenant-scoped CRUD handlers for a simple table.
 * Use this for straightforward lookup/reference tables (departments,
 * subjects, terms, academic_years, classes, class_subjects). Entities with
 * real business logic (students, attendance, exams...) get their own
 * hand-written controller instead of this factory.
 */
function createCrudController(table, { allowedFields, selectQuery = '*', orderBy = 'created_at' }) {
  async function list(req, res, next) {
    try {
      const { schoolId } = req;
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit) || 50, 200);
      const offset = (page - 1) * limit;

      let query = supabase
        .from(table)
        .select(selectQuery, { count: 'exact' })
        .eq('school_id', schoolId)
        .order(orderBy, { ascending: true })
        .range(offset, offset + limit - 1);

      // simple equality filters via ?filter[field]=value
      for (const [key, value] of Object.entries(req.query.filter || {})) {
        query = query.eq(key, value);
      }

      const { data, error, count } = await query;
      if (error) throw new ApiError(400, error.message);

      res.json({ data, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } });
    } catch (err) {
      next(err);
    }
  }

  async function getOne(req, res, next) {
    try {
      const { schoolId } = req;
      const { data, error } = await supabase
        .from(table)
        .select(selectQuery)
        .eq('school_id', schoolId)
        .eq('id', req.params.id)
        .single();

      if (error) throw new ApiError(404, `${table} record not found`);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  }

  async function create(req, res, next) {
    try {
      const { schoolId } = req;
      const payload = { school_id: schoolId };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) payload[field] = req.body[field];
      }

      const { data, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw new ApiError(400, error.message);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async function update(req, res, next) {
    try {
      const { schoolId } = req;
      const payload = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) payload[field] = req.body[field];
      }

      const { data, error } = await supabase
        .from(table)
        .update(payload)
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

  async function remove(req, res, next) {
    try {
      const { schoolId } = req;
      const { error } = await supabase.from(table).delete().eq('school_id', schoolId).eq('id', req.params.id);
      if (error) throw new ApiError(400, error.message);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  return { list, getOne, create, update, remove };
}

module.exports = { createCrudController };