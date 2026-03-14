import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSignatureRequestDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contractId!: string;

  @ApiProperty()
  @IsEmail()
  recipientEmail!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recipientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractFileName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20)
  unsignedPdfBase64?: string;
}
