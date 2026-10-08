import { BadGatewayException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let prisma: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    conversionHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('https://open.er-api.com/v6/latest'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    prisma = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('convert', () => {
    it('should successfully convert currencies using external rate and save to database', async () => {
      // Mock global fetch for external currency API
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          base_code: 'USD',
          rates: { INR: 83.25 },
        }),
      } as any);

      mockPrismaService.conversionHistory.create.mockResolvedValueOnce({
        id: 1,
        from: 'USD',
        to: 'INR',
        amount: new Prisma.Decimal(100),
        exchangeRate: new Prisma.Decimal(83.25),
        convertedAmount: new Prisma.Decimal(8325),
        createdAt: new Date(),
      });

      const result = await service.convert({
        from: 'USD',
        to: 'INR',
        amount: 100,
      });

      expect(mockFetch).toHaveBeenCalled();
      expect(mockPrismaService.conversionHistory.create).toHaveBeenCalledWith({
        data: {
          from: 'USD',
          to: 'INR',
          amount: new Prisma.Decimal(100),
          exchangeRate: new Prisma.Decimal(83.25),
          convertedAmount: new Prisma.Decimal(8325),
        },
      });
      expect(result).toEqual({
        from: 'USD',
        to: 'INR',
        amount: 100,
        exchangeRate: 83.25,
        convertedAmount: 8325,
      });

      mockFetch.mockRestore();
    });

    it('should handle same-currency conversion with rate 1 without external API call', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any);

      mockPrismaService.conversionHistory.create.mockResolvedValueOnce({
        id: 2,
        from: 'USD',
        to: 'USD',
        amount: new Prisma.Decimal(100),
        exchangeRate: new Prisma.Decimal(1),
        convertedAmount: new Prisma.Decimal(100),
        createdAt: new Date(),
      });

      const result = await service.convert({
        from: 'USD',
        to: 'USD',
        amount: 100,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({
        from: 'USD',
        to: 'USD',
        amount: 100,
        exchangeRate: 1,
        convertedAmount: 100,
      });

      mockFetch.mockRestore();
    });

    it('should throw BadGatewayException when external API returns HTTP error', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any);

      await expect(
        service.convert({ from: 'USD', to: 'INR', amount: 100 }),
      ).rejects.toThrow(BadGatewayException);

      mockFetch.mockRestore();
    });

    it('should throw BadGatewayException when external API returns error payload', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'error',
          'error-type': 'unsupported-code',
        }),
      } as any);

      await expect(
        service.convert({ from: 'XYZ', to: 'INR', amount: 100 }),
      ).rejects.toThrow(BadGatewayException);

      mockFetch.mockRestore();
    });

    it('should throw BadGatewayException when target rate is missing in upstream response', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          rates: { EUR: 0.92 },
        }),
      } as any);

      await expect(
        service.convert({ from: 'USD', to: 'INR', amount: 100 }),
      ).rejects.toThrow(BadGatewayException);

      mockFetch.mockRestore();
    });

    it('should throw BadGatewayException when external API fetch times out or rejects', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockRejectedValueOnce(
        new Error('Network timeout'),
      );

      await expect(
        service.convert({ from: 'USD', to: 'INR', amount: 100 }),
      ).rejects.toThrow(BadGatewayException);

      mockFetch.mockRestore();
    });

    it('should throw InternalServerErrorException when database fails to save conversion', async () => {
      const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: 'success',
          rates: { INR: 83.25 },
        }),
      } as any);

      mockPrismaService.conversionHistory.create.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(
        service.convert({ from: 'USD', to: 'INR', amount: 100 }),
      ).rejects.toThrow(InternalServerErrorException);

      mockFetch.mockRestore();
    });
  });

  describe('getHistory', () => {
    it('should return paginated history with default page and limit', async () => {
      const mockDate = new Date('2026-10-08T05:00:00.000Z');
      const mockRecords = [
        {
          id: 1,
          from: 'USD',
          to: 'INR',
          amount: new Prisma.Decimal(100),
          exchangeRate: new Prisma.Decimal(83.25),
          convertedAmount: new Prisma.Decimal(8325),
          createdAt: mockDate,
        },
      ];

      mockPrismaService.conversionHistory.findMany.mockResolvedValueOnce(mockRecords);
      mockPrismaService.conversionHistory.count.mockResolvedValueOnce(1);

      const result = await service.getHistory({ page: 1, limit: 10 });

      expect(mockPrismaService.conversionHistory.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: [
          {
            id: 1,
            from: 'USD',
            to: 'INR',
            amount: 100,
            exchangeRate: 83.25,
            convertedAmount: 8325,
            createdAt: mockDate.toISOString(),
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
    });

    it('should calculate skip correctly for subsequent pages', async () => {
      mockPrismaService.conversionHistory.findMany.mockResolvedValueOnce([]);
      mockPrismaService.conversionHistory.count.mockResolvedValueOnce(25);

      const result = await service.getHistory({ page: 3, limit: 10 });

      expect(mockPrismaService.conversionHistory.findMany).toHaveBeenCalledWith({
        skip: 20,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.pagination).toEqual({
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
      });
    });

    it('should throw InternalServerErrorException when database fails during history lookup', async () => {
      mockPrismaService.conversionHistory.findMany.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(service.getHistory({ page: 1, limit: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
