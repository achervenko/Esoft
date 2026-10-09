import { describe, expect, it } from "vitest";
import type { SetupFormState } from "./setup.types";
import { validateSetupForm } from "./setup.validation";

const form: SetupFormState = {
  employeeId: "1",
  email: "User1@example.com",
  username: "admin",
  lastName: "",
  firstName: "",
  middleName: "",
  password: "Secure1234",
  passwordConfirmation: "Secure1234",
};

describe("setup password validation", () => {
  it.each(["Admin123", "admin123", "ADMIN123"])(
    "rejects a password matching username regardless of case: %s",
    (password) => {
      expect(
        validateSetupForm({
          ...form,
          username: " Admin123 ",
          password,
          passwordConfirmation: password,
        }).password,
      ).toBeDefined();
    },
  );
  it.each(["User1@example.com", "user1@example.com", "USER1@EXAMPLE.COM"])(
    "rejects a password matching email regardless of case: %s",
    (password) => {
      expect(
        validateSetupForm({ ...form, password, passwordConfirmation: password })
          .password,
      ).toBeDefined();
    },
  );

  it("accepts a different password without changing its case", () => {
    expect(validateSetupForm(form)).toEqual({});
    expect(form.password).toBe("Secure1234");
  });
});
