import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status with uptime and timestamp', () => {
      const result = appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.uptime).toBe('number');
      expect(typeof result.timestamp).toBe('string');
    });
  });

  describe('Build & Watch Determinism Guardrails (MODULE_NOT_FOUND prevention)', () => {
    const repoRoot = path.resolve(__dirname, '..');

    it('should disable deleteOutDir in nest-cli.json to prevent Windows watch race conditions', () => {
      const nestCliPath = path.join(repoRoot, 'nest-cli.json');
      const nestCli = JSON.parse(fs.readFileSync(nestCliPath, 'utf-8'));

      expect(nestCli.entryFile).toBe('src/main');
      expect(nestCli.compilerOptions?.deleteOutDir).toBe(false);
    });

    it('should disable incremental compilation in tsconfig.build.json to prevent skipped module emission', () => {
      const tsconfigBuildPath = path.join(repoRoot, 'tsconfig.build.json');
      const tsconfigBuild = JSON.parse(
        fs.readFileSync(tsconfigBuildPath, 'utf-8'),
      );

      expect(tsconfigBuild.compilerOptions?.incremental).toBe(false);
      expect(tsconfigBuild.exclude).toEqual(
        expect.arrayContaining([
          'node_modules',
          'test',
          'dist',
          'coverage',
          '**/*spec.ts',
        ]),
      );
    });
  });
});
