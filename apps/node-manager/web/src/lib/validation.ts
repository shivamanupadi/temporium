export const validatePassword = (pwd: string): string | null => {
  if (pwd.length < 8) return 'At least 8 characters';
  if (!/[a-z]/.test(pwd)) return 'At least one lowercase letter';
  if (!/[A-Z]/.test(pwd)) return 'At least one uppercase letter';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return 'At least one special character (!@#$%^&*)';
  return null;
};

export const PASSWORD_REQUIREMENTS = 'Min 8 chars, uppercase, lowercase & special character';
