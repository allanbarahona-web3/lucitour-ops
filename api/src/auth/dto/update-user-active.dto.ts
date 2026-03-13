import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}
