import { ApiProperty } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(120)
  password!: string;

  @ApiProperty({ enum: AppRole, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppRole, { each: true })
  roles!: AppRole[];

  @ApiProperty({ required: false })
  @IsOptional()
  isActive?: boolean;
}
