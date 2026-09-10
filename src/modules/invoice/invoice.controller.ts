import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Roles(...INTERNAL_USERS)
  @Get('company/invoices/:id/pdf')
  @ApiOperation({ summary: 'Download seguro direto do PDF da NFS-e' })
  async downloadCompanyInvoicePdf(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const userId = req.user?.['sub'];
    const { buffer, contentType, filename } =
      await this.invoiceService.getInvoiceFileStream(id, 'pdf', userId, false);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Roles(...INTERNAL_USERS)
  @Get('company/invoices/:id/xml')
  @ApiOperation({ summary: 'Download seguro direto do XML da NFS-e' })
  async downloadCompanyInvoiceXml(
    @Req() req: Request,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const userId = req.user?.['sub'];
    const { buffer, contentType, filename } =
      await this.invoiceService.getInvoiceFileStream(id, 'xml', userId, false);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Roles(...SYSTEM_MANAGERS)
  @Get('admin/invoices/:id/pdf')
  @ApiOperation({ summary: 'Download seguro direto do PDF da NFS-e para Admin' })
  async downloadAdminInvoicePdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType, filename } =
      await this.invoiceService.getInvoiceFileStream(id, 'pdf', undefined, true);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Roles(...SYSTEM_MANAGERS)
  @Get('admin/invoices/:id/xml')
  @ApiOperation({ summary: 'Download seguro direto do XML da NFS-e para Admin' })
  async downloadAdminInvoiceXml(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, contentType, filename } =
      await this.invoiceService.getInvoiceFileStream(id, 'xml', undefined, true);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }
}
