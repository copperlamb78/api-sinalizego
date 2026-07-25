import { Test, TestingModule } from '@nestjs/testing';
import { FinancialProfileController } from './financial-profile.controller';

describe('FinancialProfileController', () => {
  let controller: FinancialProfileController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialProfileController],
    }).compile();

    controller = module.get<FinancialProfileController>(FinancialProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
