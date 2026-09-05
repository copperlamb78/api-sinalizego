import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/roles/guard/roles.guard';
import { Roles } from '../auth/roles/decorators/roles.decorator';
import {
  INTERNAL_USERS,
  SYSTEM_MANAGERS,
} from 'src/common/constants/role-groups.constant';
import { InvoiceService } from './invoice.service';
import { ListCompanyInvoicesDto } from './dto/list-company-invoices.dto';
import { ListAdminInvoicesDto } from './dto/list-admin-invoices.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Roles(...INTERNAL_USERS)
  @Get('company/invoices')
  @ApiOperation({
    summary:
      'Lista as NFS-e emitidas para a barbearia/empresa do usuário logado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de NFS-e da empresa',
  })
  async getCompanyInvoices(
    @Req() req: Request,
    @Query() query: ListCompanyInvoicesDto,
  ) {
    const userId = req.user?.['sub'];
    return this.invoiceService.getCompanyInvoices(userId, query);
  }

  @Roles(...INTERNAL_USERS)
  @Get('company/invoices/:id/appointments')
  @ApiOperation({
    summary: 'Lista os agendamentos que compõem uma NFS-e específica (Extrato)',
  })
  @ApiResponse({
    status: 200,
    description: 'Extrato detalhado de atendimentos da nota',
  })
  async getCompanyInvoiceAppointments(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const userId = req.user?.['sub'];
    return this.invoiceService.getInvoiceAppointments(id, userId, false);
  }

  @Roles(...SYSTEM_MANAGERS)
  @Get('admin/invoices')
  @ApiOperation({
    summary: 'Lista e audita todas as NFS-e emitidas na plataforma (Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista consolidada de NFS-e da plataforma',
  })
  async getAdminInvoices(@Query() query: ListAdminInvoicesDto) {
    return this.invoiceService.getAdminInvoices(query);
  }

  @Roles(...SYSTEM_MANAGERS)
  @Get('admin/invoices/:id/appointments')
  @ApiOperation({
    summary:
      'Lista os agendamentos que compõem uma NFS-e específica para o admin',
  })
  @ApiResponse({
    status: 200,
    description: 'Extrato detalhado de atendimentos da nota para o admin',
  })
  async getAdminInvoiceAppointments(@Param('id') id: string) {
    return this.invoiceService.getInvoiceAppointments(id, undefined, true);
  }
}
