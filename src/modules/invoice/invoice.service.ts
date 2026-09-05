import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasService } from 'src/asaas/asaas.service';
import { MailService } from 'src/modules/mail/mail.service';
import {
  ApptStatus,
  PlatformInvoiceStatus,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import {
  INVOICE_DESCRIPTION_TEMPLATE,
  DEFAULT_MEI_TAXES,
  DEFAULT_MUNICIPAL_SERVICE_ID,
} from 'src/common/constants/billing.constant';
import { ListCompanyInvoicesDto } from './dto/list-company-invoices.dto';
import { ListAdminInvoicesDto } from './dto/list-admin-invoices.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Cron Job mensal executado no dia 01 de cada mês às 00:05 (America/Sao_Paulo).
   * Consolida as comissões brutas acumuladas no mês anterior por Regime de Competência.
   */
  @Cron('5 0 1 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlyInvoiceConsolidation() {
    this.logger.log(
      '[Cron Invoices] Iniciando rotina de consolidação e emissão mensal de NFS-e...',
    );

    try {
      const now = new Date();
      // Se estamos em 01/10/2026, a competência a fechar é o mês 9 de 2026.
      // Se estamos em 01/01/2027, a competência é mês 12 de 2026.
      let periodMonth = now.getMonth(); // 0-indexed: no mês de Outubro (9), getMonth() é 9 -> competência 9 (Setembro).
      let periodYear = now.getFullYear();

      if (periodMonth === 0) {
        periodMonth = 12;
        periodYear -= 1;
      }

      const result = await this.consolidateAndScheduleMonthlyInvoices(
        periodYear,
        periodMonth,
      );

      this.logger.log(
        `[Cron Invoices] Rotina concluída: ${result.invoicesCreated} NFS-e emitidas para competência ${periodMonth}/${periodYear}. Total faturado: R$ ${result.totalGrossAmount.toFixed(2)}`,
      );
    } catch (err: any) {
      this.logger.error(
        `[Cron Invoices] Falha crítica na rotina de faturamento de NFS-e: ${err?.message || err}`,
        err?.stack,
      );
    }
  }

  /**
   * Consolida agendamentos e agenda NFS-e para uma competência específica (mês/ano).
   */
  async consolidateAndScheduleMonthlyInvoices(
    periodYear: number,
    periodMonth: number,
  ) {
    // Início da competência: Dia 01 às 00:00:00.000 UTC
    const periodStart = new Date(
      Date.UTC(periodYear, periodMonth - 1, 1, 0, 0, 0, 0),
    );
    // Fim da competência: Último dia do mês às 23:59:59.999 UTC
    const periodEnd = new Date(
      Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999),
    );

    const companies = await this.prisma.company.findMany({
      where: { isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cpfCnpj: true,
          },
        },
        financialProfile: {
          select: {
            id: true,
            name: true,
            email: true,
            cpfCnpj: true,
            mobilePhone: true,
            address: true,
            addressNumber: true,
            province: true,
            postalCode: true,
          },
        },
      },
    });

    let processedCompanies = 0;
    let invoicesCreated = 0;
    let totalGrossAmount = 0;

    for (const company of companies) {
      processedCompanies++;

      try {
        // 1. Idempotência: verifica se já existe nota criada para esta empresa e competência
        const existingInvoice = await this.prisma.platformInvoice.findUnique({
          where: {
            companyId_periodYear_periodMonth: {
              companyId: company.id,
              periodYear,
              periodMonth,
            },
          },
        });

        if (existingInvoice) {
          this.logger.log(
            `[Invoice Service] NFS-e da empresa "${company.businessName}" já emitida para ${periodMonth}/${periodYear}. Pulando.`,
          );
          continue;
        }

        // 2. Busca agendamentos elegíveis com platformInvoiceId nulo
        // Considera agendamentos com pagamento online de sinal/taxa confirmado
        const eligibleAppointments = await this.prisma.appointment.findMany({
          where: {
            companyId: company.id,
            platformInvoiceId: null,
            appointmentDate: {
              gte: periodStart,
              lte: periodEnd,
            },
            status: {
              in: [
                ApptStatus.CONFIRMED,
                ApptStatus.COMPLETED,
                ApptStatus.NO_SHOW,
                ApptStatus.CANCELED,
              ],
            },
            transactions: {
              some: {
                type: TransactionType.DEPOSIT,
                status: {
                  in: [TransactionStatus.CONFIRMED, TransactionStatus.REFUNDED],
                },
              },
            },
          },
          select: {
            id: true,
            platformFeeAmount: true,
          },
        });

        if (!eligibleAppointments || eligibleAppointments.length === 0) {
          continue;
        }

        // 3. Soma do valor cheio/bruto da taxa de comissão
        const grossAmount = eligibleAppointments.reduce(
          (sum, appt) => sum + Number(appt.platformFeeAmount),
          0,
        );

        if (grossAmount <= 0) {
          continue;
        }

        const formattedGrossAmount = Number(grossAmount.toFixed(2));

        // 4. Garantir que a empresa possui platformCustomerId na conta mestre do Asaas
        let platformCustomerId = company.platformCustomerId;

        if (!platformCustomerId) {
          const doc =
            company.financialProfile?.cpfCnpj || company.owner?.cpfCnpj;
          const name =
            company.financialProfile?.name ||
            company.businessName ||
            company.owner?.name;

          if (!doc) {
            this.logger.warn(
              `[Invoice Service] Empresa #${company.id} ("${company.businessName}") sem CPF/CNPJ configurado. Não é possível emitir NFS-e.`,
            );
            continue;
          }

          platformCustomerId =
            await this.asaasService.createCustomerInMasterAccount({
              name,
              cpfCnpj: doc,
              email: company.financialProfile?.email || company.owner?.email,
              phone: company.whatsapp || company.owner?.phone,
              mobilePhone:
                company.financialProfile?.mobilePhone || company.owner?.phone,
              address: company.street || company.financialProfile?.address,
              addressNumber:
                company.number || company.financialProfile?.addressNumber,
              province: company.district || company.financialProfile?.province,
              postalCode:
                company.zipCode || company.financialProfile?.postalCode,
              externalReference: `company_${company.id}`,
            });

          await this.prisma.company.update({
            where: { id: company.id },
            data: { platformCustomerId },
          });
        }

        // 5. Formatar descrição com interpolação de mês/ano
        const monthPadded = String(periodMonth).padStart(2, '0');
        const serviceDescription = INVOICE_DESCRIPTION_TEMPLATE.replace(
          '{{MES}}',
          monthPadded,
        ).replace('{{ANO}}', String(periodYear));

        const effectiveDateString = new Date().toISOString().split('T')[0];
        const appointmentIds = eligibleAppointments.map((a) => a.id);

        // 6. Transação Atômica: Cria a PlatformInvoice e carimba os agendamentos
        const createdInvoice = await this.prisma.$transaction(async (tx) => {
          const invoice = await tx.platformInvoice.create({
            data: {
              companyId: company.id,
              periodMonth,
              periodYear,
              periodStart,
              periodEnd,
              grossAmount: formattedGrossAmount,
              appointmentsCount: appointmentIds.length,
              effectiveDate: new Date(),
              status: PlatformInvoiceStatus.SCHEDULED,
            },
          });

          await tx.appointment.updateMany({
            where: { id: { in: appointmentIds } },
            data: { platformInvoiceId: invoice.id },
          });

          return invoice;
        });

        // 7. Chamada externa à API do Asaas (fora da transação de banco)
        try {
          const asaasInvoice = await this.asaasService.scheduleInvoice({
            customerId: platformCustomerId,
            serviceDescription,
            value: formattedGrossAmount,
            effectiveDate: effectiveDateString,
            externalReference: createdInvoice.id,
            taxes: DEFAULT_MEI_TAXES,
            municipalServiceId:
              process.env.ASAAS_INVOICE_MUNICIPAL_SERVICE_ID ||
              DEFAULT_MUNICIPAL_SERVICE_ID,
          });

          await this.prisma.platformInvoice.update({
            where: { id: createdInvoice.id },
            data: {
              asaasInvoiceId: asaasInvoice.id,
              status: asaasInvoice.status || PlatformInvoiceStatus.SCHEDULED,
              pdfUrl: asaasInvoice.pdfUrl || null,
              xmlUrl: asaasInvoice.xmlUrl || null,
            },
          });

          invoicesCreated++;
          totalGrossAmount += formattedGrossAmount;

          this.logger.log(
            `[Invoice Service] NFS-e agendada com sucesso para "${company.businessName}" (${monthPadded}/${periodYear}): R$ ${formattedGrossAmount.toFixed(2)} [Asaas ID: ${asaasInvoice.id}]`,
          );
        } catch (apiErr: any) {
          this.logger.error(
            `[Invoice Service] Falha ao agendar NFS-e no Asaas para empresa #${company.id}: ${apiErr?.message || apiErr}`,
          );

          await this.prisma.platformInvoice.update({
            where: { id: createdInvoice.id },
            data: {
              status: PlatformInvoiceStatus.ERROR,
              errorMessage:
                apiErr?.message || 'Falha na comunicação com gateway Asaas',
            },
          });

          // Disparo de e-mail de alerta ao administrador
          const adminAlertEmail =
            process.env.ADMIN_ALERT_EMAIL ||
            process.env.MAIL_FROM_EMAIL ||
            'admin@sinalizego.com';

          await this.mailService
            .sendInvoiceErrorAlertEmail(adminAlertEmail, {
              invoiceId: createdInvoice.id,
              companyName: company.businessName,
              companyId: company.id,
              competence: `${monthPadded}/${periodYear}`,
              grossAmount: formattedGrossAmount,
              errorMessage:
                apiErr?.message || 'Erro desconhecido ao agendar nota fiscal',
            })
            .catch((mailErr) => {
              this.logger.warn(
                `[Invoice Service] Falha ao enviar e-mail de alerta de erro de NFS-e: ${mailErr?.message || mailErr}`,
              );
            });
        }
      } catch (compErr: any) {
        this.logger.error(
          `[Invoice Service] Erro inesperado ao processar NFS-e da empresa #${company.id}: ${compErr?.message || compErr}`,
        );
      }
    }

    return {
      processedCompanies,
      invoicesCreated,
      totalGrossAmount,
    };
  }

  /**
   * Consulta paginada das NFS-e emitidas para a empresa do usuário autenticado.
   */
  async getCompanyInvoices(userId: string, query: ListCompanyInvoicesDto) {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    // Busca a empresa do usuário (ou valida se a companyId informada pertence ao usuário)
    const companyWhere: any = { userId, isActive: true };
    if (query.companyId) {
      companyWhere.id = query.companyId;
    }

    const company = await this.prisma.company.findFirst({
      where: companyWhere,
      select: { id: true, businessName: true },
    });

    if (!company) {
      throw new NotFoundException(
        'Empresa não encontrada para o usuário autenticado.',
      );
    }

    const where: any = {
      companyId: company.id,
    };

    if (query.year) {
      where.periodYear = Number(query.year);
    }

    if (query.month) {
      where.periodMonth = Number(query.month);
    }

    if (query.status) {
      where.status = query.status;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.platformInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        select: {
          id: true,
          companyId: true,
          periodMonth: true,
          periodYear: true,
          periodStart: true,
          periodEnd: true,
          grossAmount: true,
          appointmentsCount: true,
          status: true,
          invoiceNumber: true,
          pdfUrl: true,
          xmlUrl: true,
          errorMessage: true,
          effectiveDate: true,
          authorizedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.platformInvoice.count({ where }),
    ]);

    return {
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Consulta paginada de todas as NFS-e emitidas na plataforma (Admin).
   */
  async getAdminInvoices(query: ListAdminInvoicesDto) {
    const page = query.page && query.page > 0 ? Number(query.page) : 1;
    const limit = query.limit && query.limit > 0 ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.year) {
      where.periodYear = Number(query.year);
    }

    if (query.month) {
      where.periodMonth = Number(query.month);
    }

    if (query.status) {
      where.status = query.status;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.platformInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { periodYear: 'desc' },
          { periodMonth: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          id: true,
          companyId: true,
          periodMonth: true,
          periodYear: true,
          periodStart: true,
          periodEnd: true,
          grossAmount: true,
          appointmentsCount: true,
          status: true,
          invoiceNumber: true,
          pdfUrl: true,
          xmlUrl: true,
          errorMessage: true,
          effectiveDate: true,
          authorizedAt: true,
          createdAt: true,
          company: {
            select: {
              id: true,
              businessName: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.platformInvoice.count({ where }),
    ]);

    return {
      data: invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Lista os agendamentos cobertos por uma nota fiscal específica (Extrato da NFS-e).
   */
  async getInvoiceAppointments(
    invoiceId: string,
    userId?: string,
    isAdmin = false,
  ) {
    const invoice = await this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: { select: { id: true, userId: true, businessName: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Nota fiscal não encontrada.');
    }

    if (!isAdmin && invoice.company.userId !== userId) {
      throw new NotFoundException('Nota fiscal não encontrada.');
    }

    const appointments = await this.prisma.appointment.findMany({
      where: { platformInvoiceId: invoiceId },
      select: {
        id: true,
        appointmentDate: true,
        servicePrice: true,
        downPaymentAmount: true,
        platformFeeAmount: true,
        status: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    return {
      invoice: {
        id: invoice.id,
        companyName: invoice.company.businessName,
        periodMonth: invoice.periodMonth,
        periodYear: invoice.periodYear,
        grossAmount: invoice.grossAmount,
        appointmentsCount: invoice.appointmentsCount,
        status: invoice.status,
        invoiceNumber: invoice.invoiceNumber,
        pdfUrl: invoice.pdfUrl,
        xmlUrl: invoice.xmlUrl,
      },
      appointments,
    };
  }
}
