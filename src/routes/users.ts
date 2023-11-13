import { Router } from "express";
import { prisma } from "../utils/db";
import { checkSchema } from "express-validator";
import { validate } from "../utils/validators/validator";
import { GetUserByID } from "../utils/validators/users";

const router = Router({ mergeParams: true });

/* router.get("/:uid", validate(GetUserByID), async (req, res) => {
  prisma.user.findUnique({ where: { id: req.body.id } });
  return res.json({ response: req });
}); */

export default router;
