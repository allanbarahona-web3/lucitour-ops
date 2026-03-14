import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewSignatureRequestDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsString()
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  reviewerUserId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20)
  lucitoursSignatureImageBase64?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20)
  signedPdfBase64?: string;
}
