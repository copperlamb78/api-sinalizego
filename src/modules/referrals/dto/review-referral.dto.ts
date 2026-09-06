import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewReferralDto {
  @ApiProperty({
    description: 'Define se a indicação é aprovada ou rejeitada',
    example: true,
  })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({
    description: 'Motivo da rejeição caso não seja aprovada',
    example: 'Auto-indicação confirmada por mesma chave Pix',
  })
  @IsOptional()
  @IsString()
  rejectedReason?: string;
}
