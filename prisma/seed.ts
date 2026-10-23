import { PrismaClient, ApptStatus, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { addDays, setHours, setMinutes } from 'date-fns';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Iniciando o seed completo do ecossistema SinalizeGO... 🌱');

  const passwordHash = await bcrypt.hash('senha123', 10);

  // 1. SUPER ADMIN (Acesso irrestrito à plataforma)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@sinalizego.com' },
    update: {
      password: passwordHash,
      name: 'Gabriel Super Admin',
      role: Role.SUPER_ADMIN,
      phone: '11999999999',
      cpfCnpj: '00000000000',
      isActive: true,
    },
    create: {
      email: 'admin@sinalizego.com',
      name: 'Gabriel Super Admin',
      password: passwordHash,
      role: Role.SUPER_ADMIN,
      phone: '11999999999',
      cpfCnpj: '00000000000',
      isActive: true,
    },
  });

  // 2. DONO DE ESTABELECIMENTO 1: BARBEARIA RETRÔ CLUB
  const barberOwner = await prisma.user.upsert({
    where: { email: 'barbeiro@teste.com' },
    update: {
      password: passwordHash,
      name: 'Carlos Barbeiro',
      role: Role.COMPANY_OWNER,
      phone: '11988888888',
      cpfCnpj: '11122233344',
      isActive: true,
    },
    create: {
      email: 'barbeiro@teste.com',
      name: 'Carlos Barbeiro',
      password: passwordHash,
      role: Role.COMPANY_OWNER,
      phone: '11988888888',
      cpfCnpj: '11122233344',
      isActive: true,
    },
  });

  // Empresa 1: Barbearia Retrô Club
  const companyBarbearia = await prisma.company.upsert({
    where: { slug: 'barbearia-retro' },
    update: {
      userId: barberOwner.id,
      businessName: 'Barbearia Retrô Club',
      whatsapp: '11988888888',
      chairsCount: 3,
      providerType: 'Barbearia',
      district: 'Bela Vista',
      street: 'Avenida Paulista',
      number: '1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      timezone: 'America/Sao_Paulo',
      themePalette: 'default',
      isActive: true,
    },
    create: {
      userId: barberOwner.id,
      businessName: 'Barbearia Retrô Club',
      slug: 'barbearia-retro',
      whatsapp: '11988888888',
      chairsCount: 3,
      providerType: 'Barbearia',
      district: 'Bela Vista',
      street: 'Avenida Paulista',
      number: '1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      timezone: 'America/Sao_Paulo',
      themePalette: 'default',
      isActive: true,
    },
  });

  // Grupos de Serviços da Barbearia
  let groupCabelo = await prisma.serviceGroup.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Corte & Cabelo' },
  });
  if (!groupCabelo) {
    groupCabelo = await prisma.serviceGroup.create({
      data: {
        name: 'Corte & Cabelo',
        capacity: 2,
        companyId: companyBarbearia.id,
      },
    });
  }

  let groupBarba = await prisma.serviceGroup.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Barba & Rosto' },
  });
  if (!groupBarba) {
    groupBarba = await prisma.serviceGroup.create({
      data: {
        name: 'Barba & Rosto',
        capacity: 2,
        companyId: companyBarbearia.id,
      },
    });
  }

  let groupCombos = await prisma.serviceGroup.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Combos & VIP' },
  });
  if (!groupCombos) {
    groupCombos = await prisma.serviceGroup.create({
      data: {
        name: 'Combos & VIP',
        capacity: 1,
        companyId: companyBarbearia.id,
      },
    });
  }

  // Serviços da Barbearia
  // 1. Corte Tradicional / Social (R$ 45, 50% sinal)
  let servCorte = await prisma.service.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Corte Degradê / Social' },
  });
  if (!servCorte) {
    servCorte = await prisma.service.create({
      data: {
        companyId: companyBarbearia.id,
        serviceGroupId: groupCabelo.id,
        name: 'Corte Degradê / Social',
        description: 'Corte moderno com máquina e tesoura, finalizado com navalhete e pomada.',
        durationMinutes: 30,
        totalPrice: 45.0,
        downPaymentPercent: 50,
      },
    });
  }

  // 2. Barba Terapia (R$ 35, 50% sinal)
  let servBarba = await prisma.service.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Barba Terapia com Toalha Quente' },
  });
  if (!servBarba) {
    servBarba = await prisma.service.create({
      data: {
        companyId: companyBarbearia.id,
        serviceGroupId: groupBarba.id,
        name: 'Barba Terapia com Toalha Quente',
        description: 'Modelagem de barba com toalha quente, óleos essenciais e balm hidratante.',
        durationMinutes: 30,
        totalPrice: 35.0,
        downPaymentPercent: 50,
      },
    });
  }

  // 3. Sobrancelha Express (R$ 12,00 - Regra N1 Sinal 100%)
  let servExpress = await prisma.service.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Sobrancelha Express na Navalha' },
  });
  if (!servExpress) {
    servExpress = await prisma.service.create({
      data: {
        companyId: companyBarbearia.id,
        serviceGroupId: groupBarba.id,
        name: 'Sobrancelha Express na Navalha',
        description: 'Alinhamento rápido de sobrancelhas masculinas na navalha.',
        durationMinutes: 15,
        totalPrice: 12.0,
        downPaymentPercent: 100, // Regra N1 (< R$ 15,00)
      },
    });
  }

  // 4. Combo Completo Barba + Cabelo (R$ 75,00)
  let servCombo = await prisma.service.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Combo Completo (Cabelo + Barba)' },
  });
  if (!servCombo) {
    servCombo = await prisma.service.create({
      data: {
        companyId: companyBarbearia.id,
        serviceGroupId: groupCombos.id,
        name: 'Combo Completo (Cabelo + Barba)',
        description: 'O tratamento completo com corte degradê, barba com toalha quente e lavagem.',
        durationMinutes: 60,
        totalPrice: 75.0,
        downPaymentPercent: 50,
      },
    });
  }

  // 5. Dia do Noivo VIP (R$ 450,00 - Regra N3 Sinal Flexível 30%)
  let servVip = await prisma.service.findFirst({
    where: { companyId: companyBarbearia.id, name: 'Dia do Noivo VIP' },
  });
  if (!servVip) {
    servVip = await prisma.service.create({
      data: {
        companyId: companyBarbearia.id,
        serviceGroupId: groupCombos.id,
        name: 'Dia do Noivo VIP',
        description: 'Pacote exclusivo com cabelo, barba, hidratação profunda, massagem facial e brinde especial.',
        durationMinutes: 180,
        totalPrice: 450.0,
        downPaymentPercent: 30, // Regra N3 (>= R$ 400,00)
      },
    });
  }

  // Horários de Funcionamento (Working Hours) da Barbearia (0 = Domingo a 6 = Sábado)
  const workingHoursData = [
    { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isClosed: true },
    { dayOfWeek: 1, startTime: '09:00', endTime: '19:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
    { dayOfWeek: 2, startTime: '09:00', endTime: '19:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
    { dayOfWeek: 3, startTime: '09:00', endTime: '19:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
    { dayOfWeek: 4, startTime: '09:00', endTime: '19:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
    { dayOfWeek: 5, startTime: '09:00', endTime: '19:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
    { dayOfWeek: 6, startTime: '09:00', endTime: '18:00', lunchStartTime: '12:00', lunchEndTime: '13:00', isClosed: false },
  ];

  for (const wh of workingHoursData) {
    await prisma.workingHour.upsert({
      where: {
        companyId_dayOfWeek: {
          companyId: companyBarbearia.id,
          dayOfWeek: wh.dayOfWeek,
        },
      },
      update: wh,
      create: {
        ...wh,
        companyId: companyBarbearia.id,
      },
    });
  }

  // Funcionários da Barbearia
  let empJoao = await prisma.employee.findFirst({
    where: { companyId: companyBarbearia.id, email: 'joao.barbeiro@teste.com' },
  });
  if (!empJoao) {
    empJoao = await prisma.employee.create({
      data: {
        companyId: companyBarbearia.id,
        name: 'João Navalha Master',
        email: 'joao.barbeiro@teste.com',
        phone: '11988881111',
        roleTitle: 'Barbeiro Master',
        isActive: true,
      },
    });

    // Vincular João aos serviços
    await prisma.employeeService.createMany({
      data: [
        { employeeId: empJoao.id, serviceId: servCorte.id },
        { employeeId: empJoao.id, serviceId: servBarba.id },
        { employeeId: empJoao.id, serviceId: servCombo.id },
        { employeeId: empJoao.id, serviceId: servVip.id },
      ],
      skipDuplicates: true,
    });

    // Vincular João aos grupos
    await prisma.employeeGroup.createMany({
      data: [
        { employeeId: empJoao.id, serviceGroupId: groupCabelo.id },
        { employeeId: empJoao.id, serviceGroupId: groupBarba.id },
        { employeeId: empJoao.id, serviceGroupId: groupCombos.id },
      ],
      skipDuplicates: true,
    });
  }

  let empMarcos = await prisma.employee.findFirst({
    where: { companyId: companyBarbearia.id, email: 'marcos.barbeiro@teste.com' },
  });
  if (!empMarcos) {
    empMarcos = await prisma.employee.create({
      data: {
        companyId: companyBarbearia.id,
        name: 'Marcos Silva',
        email: 'marcos.barbeiro@teste.com',
        phone: '11988882222',
        roleTitle: 'Especialista em Degradê & Fade',
        isActive: true,
      },
    });

    // Vincular Marcos aos serviços
    await prisma.employeeService.createMany({
      data: [
        { employeeId: empMarcos.id, serviceId: servCorte.id },
        { employeeId: empMarcos.id, serviceId: servExpress.id },
      ],
      skipDuplicates: true,
    });

    // Vincular Marcos ao grupo
    await prisma.employeeGroup.createMany({
      data: [{ employeeId: empMarcos.id, serviceGroupId: groupCabelo.id }],
      skipDuplicates: true,
    });
  }

  // 3. USUÁRIO COM PAPEL EMPLOYEE (Para testar login direto com role EMPLOYEE)
  const employeeUser = await prisma.user.upsert({
    where: { email: 'funcionario@teste.com' },
    update: {
      password: passwordHash,
      name: 'João Navalha (Funcionário)',
      role: Role.EMPLOYEE,
      phone: '11988881111',
      isActive: true,
    },
    create: {
      email: 'funcionario@teste.com',
      name: 'João Navalha (Funcionário)',
      password: passwordHash,
      role: Role.EMPLOYEE,
      phone: '11988881111',
      isActive: true,
    },
  });

  // 4. DONO DE ESTABELECIMENTO 2: STUDIO BELLA ESTÉTICA (Multi-Tenancy e Isolamento)
  const salaoOwner = await prisma.user.upsert({
    where: { email: 'salao@teste.com' },
    update: {
      password: passwordHash,
      name: 'Mariana Designer',
      role: Role.COMPANY_OWNER,
      phone: '11977770000',
      cpfCnpj: '22233344455',
      isActive: true,
    },
    create: {
      email: 'salao@teste.com',
      name: 'Mariana Designer',
      password: passwordHash,
      role: Role.COMPANY_OWNER,
      phone: '11977770000',
      cpfCnpj: '22233344455',
      isActive: true,
    },
  });

  const companySalao = await prisma.company.upsert({
    where: { slug: 'studio-bella' },
    update: {
      userId: salaoOwner.id,
      businessName: 'Studio Bella Estética',
      whatsapp: '11977770000',
      chairsCount: 2,
      providerType: 'Salão & Estética',
      district: 'Jardins',
      street: 'Rua Oscar Freire',
      number: '500',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01426-000',
      timezone: 'America/Sao_Paulo',
      themePalette: 'emerald',
      isActive: true,
    },
    create: {
      userId: salaoOwner.id,
      businessName: 'Studio Bella Estética',
      slug: 'studio-bella',
      whatsapp: '11977770000',
      chairsCount: 2,
      providerType: 'Salão & Estética',
      district: 'Jardins',
      street: 'Rua Oscar Freire',
      number: '500',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01426-000',
      timezone: 'America/Sao_Paulo',
      themePalette: 'emerald',
      isActive: true,
    },
  });

  let groupEstetica = await prisma.serviceGroup.findFirst({
    where: { companyId: companySalao.id, name: 'Estética & Manicure' },
  });
  if (!groupEstetica) {
    groupEstetica = await prisma.serviceGroup.create({
      data: {
        name: 'Estética & Manicure',
        capacity: 2,
        companyId: companySalao.id,
      },
    });
  }

  let servManicure = await prisma.service.findFirst({
    where: { companyId: companySalao.id, name: 'Manicure & Pedicure Spa' },
  });
  if (!servManicure) {
    servManicure = await prisma.service.create({
      data: {
        companyId: companySalao.id,
        serviceGroupId: groupEstetica.id,
        name: 'Manicure & Pedicure Spa',
        description: 'Cutilagem e esmaltação profissional com esfoliação e hidratação.',
        durationMinutes: 50,
        totalPrice: 65.0,
        downPaymentPercent: 50,
      },
    });
  }

  for (const wh of workingHoursData) {
    await prisma.workingHour.upsert({
      where: {
        companyId_dayOfWeek: {
          companyId: companySalao.id,
          dayOfWeek: wh.dayOfWeek,
        },
      },
      update: wh,
      create: {
        ...wh,
        companyId: companySalao.id,
      },
    });
  }

  // 5. CLIENTES DE TESTE
  const client1 = await prisma.user.upsert({
    where: { email: 'cliente@teste.com' },
    update: {
      password: passwordHash,
      name: 'Lucas Mendes (Cliente)',
      role: Role.CLIENT,
      phone: '11977777777',
      cpfCnpj: '33344455566',
      isActive: true,
    },
    create: {
      email: 'cliente@teste.com',
      name: 'Lucas Mendes (Cliente)',
      password: passwordHash,
      role: Role.CLIENT,
      phone: '11977777777',
      cpfCnpj: '33344455566',
      isActive: true,
    },
  });

  const client2 = await prisma.user.upsert({
    where: { email: 'cliente2@teste.com' },
    update: {
      password: passwordHash,
      name: 'Fernanda Souza (Cliente)',
      role: Role.CLIENT,
      phone: '11966666666',
      cpfCnpj: '44455566677',
      isActive: true,
    },
    create: {
      email: 'cliente2@teste.com',
      name: 'Fernanda Souza (Cliente)',
      password: passwordHash,
      role: Role.CLIENT,
      phone: '11966666666',
      cpfCnpj: '44455566677',
      isActive: true,
    },
  });

  // 6. AGENDAMENTO DE DEMONSTRAÇÃO (Para visualização de agendas e métricas)
  // Amanhã às 14:00
  const tomorrowAt14 = setMinutes(setHours(addDays(new Date(), 1), 14), 0);
  const tomorrowAt1430 = setMinutes(setHours(addDays(new Date(), 1), 14), 30);

  const existingAppt = await prisma.appointment.findFirst({
    where: {
      companyId: companyBarbearia.id,
      clientId: client1.id,
      serviceId: servCorte.id,
    },
  });

  if (!existingAppt) {
    await prisma.appointment.create({
      data: {
        companyId: companyBarbearia.id,
        serviceId: servCorte.id,
        clientId: client1.id,
        employeeId: empJoao.id,
        appointmentDate: tomorrowAt14,
        appointmentEndDate: tomorrowAt1430,
        status: ApptStatus.CONFIRMED,
        servicePrice: 45.0,
        downPaymentAmount: 22.5,
        platformFeeAmount: 2.25,
        pixTxId: 'pix_mock_seed_123456',
      },
    });
  }

  console.log('✅ Banco populado com sucesso com dados realistas!');
  console.log('---------------------------------------------------------');
  console.log('🔑 Senha padrão de todos os usuários: senha123');
  console.log('---------------------------------------------------------');
  console.log('👤 SUPER ADMIN:       admin@sinalizego.com');
  console.log('💈 DONO BARBEARIA:    barbeiro@teste.com');
  console.log('💇 DONA SALÃO:        salao@teste.com');
  console.log('✂️ FUNCIONÁRIO USER:  funcionario@teste.com');
  console.log('🧑 CLIENTE 1:         cliente@teste.com');
  console.log('👩 CLIENTE 2:         cliente2@teste.com');
  console.log('---------------------------------------------------------');
  console.log('🏪 Barbearia URL:     /empresa/barbearia-retro');
  console.log('💅 Salão URL:         /empresa/studio-bella');
  console.log('📊 Painel URL:        /painel');
  console.log('---------------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao rodar o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
