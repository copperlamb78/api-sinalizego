import { Test, TestingModule } from '@nestjs/testing';
import { FinancialProfileService } from './financial-profile.service';

describe('FinancialProfileService', () => {
  let service: FinancialProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinancialProfileService],
    }).compile();

    service = module.get<FinancialProfileService>(FinancialProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
