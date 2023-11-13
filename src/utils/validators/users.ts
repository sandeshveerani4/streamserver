import { Schema } from "express-validator";

export const GetUserByID: Schema = {
  uid: {
    isMongoId: true,
  },
};
