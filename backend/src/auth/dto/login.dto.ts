import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Email completo o nombre de usuario (parte antes de @)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  identifier!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(120)
  password!: string;
}
