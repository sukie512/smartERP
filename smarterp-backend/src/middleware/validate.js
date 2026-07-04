const { validationResult } = require('express-validator');

/**
 * Runs after express-validator rules.
 * If any rule failed, returns 400 with all error messages.
 * Otherwise calls next() to proceed to controller.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;
