import { NextFunction, Request, Response } from "express";
import { Schema, checkSchema, validationResult } from "express-validator";

export const validate = (schema: Schema) => {
  return [
    checkSchema(schema),
    (req: Request, res: Response, next: NextFunction) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
      }
      next();
    },
  ];
};
