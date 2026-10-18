import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('Avaliações')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Envia uma avaliação para um atendimento concluído' })
  @ApiBody({ type: CreateReviewDto })
  @ApiResponse({ status: 201, description: 'Avaliação registrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Agendamento não concluído ou dados inválidos' })
  @ApiResponse({ status: 403, description: 'Não autorizado a avaliar este agendamento' })
  @ApiResponse({ status: 409, description: 'Agendamento já possui avaliação' })
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @Req() req: Request,
  ) {
    const clientId = req.user?.['sub'];
    return this.reviewsService.create(createReviewDto, clientId);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Consulta as avaliações públicas de uma empresa' })
  @ApiParam({ name: 'companyId', description: 'ID da empresa (UUID)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Lista de avaliações retornada com sucesso' })
  async getCompanyReviews(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.reviewsService.getCompanyReviews(companyId, pageNum, limitNum);
  }
}
