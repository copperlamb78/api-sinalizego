import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { CreateFinancialProfileDto } from './dto/create-financial-profile.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import type { Request } from 'express';

@ApiTags('Perfil Financeiro')
@Controller('financial-profile')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('create')
  @ApiOperation({
    summary: 'Cria o perfil financeiro (subconta Asaas) do usuário',
  })
  @ApiBody({
    type: CreateFinancialProfileDto,
    description: 'Dados para criação da subconta financeira no Asaas',
  })
  @ApiResponse({
    status: 201,
    description: 'Perfil financeiro criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Erro de validação ou erro retornado pelo Asaas',
  })
  @ApiResponse({
    status: 409,
    description: 'Usuário ou CPF/CNPJ já possui perfil financeiro',
  })
  @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  async create(@Body() data: CreateFinancialProfileDto, @Req() req: Request) {
    const userId = req.user?.['sub'];

    if (!userId) {
      throw new UnauthorizedException(
        'ID do usuário não encontrado no token JWT',
      );
    }
    return this.financialProfileService.createFinancialProfile(data, userId);
  }

  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Get('me')
  // @ApiOperation({ summary: 'Retorna o perfil financeiro do usuário logado' })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Perfil financeiro retornado com sucesso',
  // })
  // @ApiResponse({ status: 404, description: 'Perfil financeiro não encontrado' })
  // @ApiResponse({ status: 500, description: 'Erro interno do servidor' })
  // async getMyProfile(@Req() req: Request) {
  //   const userId = req.user?.['sub'];
  //   return this.financialProfileService.getFinancialProfileByUserId(userId);
  // }
}
