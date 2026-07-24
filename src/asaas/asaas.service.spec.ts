import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from './asaas.service';

describe('AsaasService', () => {
  let service: AsaasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsaasService],
    }).compile();

    service = module.get<AsaasService>(AsaasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
