import type { Request, Response, NextFunction } from 'express';
import validator from 'express-validator';

export const validateRequest = (schema: Record<string, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = validator.checkSchema(schema);
      await validation.run(req);

      // Simple validation check for required fields
      const { body, params, query } = req;
      const fields = { ...body, ...params, ...query };

      const hasRequiredFields = Object.keys(schema).every(field => 
        schema[field].required ? fields[field] !== undefined : true
      );

      if (!hasRequiredFields) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: 'Invalid or missing required fields'
        });
      }

      return next();
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
};