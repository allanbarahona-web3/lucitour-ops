import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitSignatureDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  otpCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  signatureImageBase64!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  clientDeviceInfo?: string;
}
