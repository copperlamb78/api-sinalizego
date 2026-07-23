import { Role } from '@prisma/client';

// Grupo de quem trabalha no sistema (todo mundo menos o CLIENT final)
export const INTERNAL_USERS = [
  Role.PROVIDER,
  Role.EMPLOYEE,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

export const INTERNAL_NO_EMPLOYEE = [
  Role.PROVIDER,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

// Grupo de donos do sistema (você e seu suporte)
export const SYSTEM_MANAGERS = [Role.ADMIN, Role.SUPER_ADMIN];
