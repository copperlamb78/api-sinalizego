import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterServiceDto {
  @ApiPropertyOptional({ example: 'active', description: 'Status do serviço' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 50, description: 'Preço exato do serviço' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalPrice?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  availableEmployers?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  downPaymentPercent?: number;

  @ApiPropertyOptional({ example: 'desc', description: 'Ordem de ordenação' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'], { message: 'O orderBy deve ser "asc" ou "desc".' })
  orderBy?: 'asc' | 'desc';
}
