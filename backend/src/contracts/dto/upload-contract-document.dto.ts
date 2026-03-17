import { ApiProperty } from '@nestjs/swagger';
import { ContractDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadContractDocumentDto {
  @ApiProperty({ enum: ContractDocumentType })
  @IsEnum(ContractDocumentType)
  type!: ContractDocumentType;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  contentType!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  fileBase64!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  uploadedByUserId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  ownerName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  concept?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  conceptOther?: string;
}
