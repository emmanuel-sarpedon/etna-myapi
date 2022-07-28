import { body } from "express-validator";

export const UserCreationSchema = [
   body("username").isByteLength({ min: 3, max: 20 }),
   body("pseudo").isByteLength({ min: 3, max: 20 }),
   body("email").isEmail(),
   body("password")
      .isByteLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
];
