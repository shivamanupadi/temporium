import { IsString, MinLength, Matches } from 'class-validator';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
const PASSWORD_MESSAGE =
  'Password must be at least 8 characters with uppercase, lowercase, and special character (!@#$%^&*)';

export class LoginDto {
  @IsString()
  @MinLength(1)
  password: string;
}

export class SetupDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
