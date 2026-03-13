import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SendContractPdfDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  messageText!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  pdfBase64!: string;
}
