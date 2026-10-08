import {
  BadGatewayException,
  INestApplication,
  InternalServerErrorException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HttpExceptionFilter } from '../http-exception.filter';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

describe('CurrencyController (HTTP & Validation Integration)', () => {
  let app: INestApplication;
  let currencyService: jest.Mocked<Partial<CurrencyService>>;

  beforeEach(async () => {
    currencyService = {
      convert: jest.fn(),
      getHistory: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyController],
      providers: [
        {
          provide: CurrencyService,
          useValue: currencyService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /currency/convert', () => {
    // 1. Valid conversion
    it('1. should return 200 and conversion result for valid parameters', async () => {
      (currencyService.convert as jest.Mock).mockResolvedValueOnce({
        from: 'USD',
        to: 'INR',
        amount: 100,
        exchangeRate: 83.25,
        convertedAmount: 8325,
      });

      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: 100 })
        .expect(200);

      expect(res.body).toEqual({
        from: 'USD',
        to: 'INR',
        amount: 100,
        exchangeRate: 83.25,
        convertedAmount: 8325,
      });
    });

    // 2. Missing from
    it('2. should return 400 when from is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ to: 'INR', amount: 100 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('from currency is required');
    });

    // 3. Missing to
    it('3. should return 400 when to is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', amount: 100 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('to currency is required');
    });

    // 4. Missing amount
    it('4. should return 400 when amount is missing', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('amount is required');
    });

    // 5. Invalid currency length
    it('5. should return 400 when currency length is not 3', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'US', to: 'INR', amount: 100 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('must be exactly 3 characters');
    });

    // 6. Invalid currency format
    it('6. should return 400 when currency code contains non-alphabetic characters', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'U12', to: 'INR', amount: 100 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('must contain only alphabetic');
    });

    // 7. Amount = 0
    it('7. should return 400 when amount is 0', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: 0 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('amount must be greater than 0');
    });

    // 8. Negative amount
    it('8. should return 400 when amount is negative', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: -50 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('amount must be greater than 0');
    });

    // 9. Non-numeric amount
    it('9. should return 400 when amount is not a number', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: 'abc' })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('amount must be a valid number');
    });

    // 10. Same currency conversion
    it('10. should handle same-currency conversion successfully', async () => {
      (currencyService.convert as jest.Mock).mockResolvedValueOnce({
        from: 'USD',
        to: 'USD',
        amount: 100,
        exchangeRate: 1,
        convertedAmount: 100,
      });

      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'USD', amount: 100 })
        .expect(200);

      expect(res.body).toEqual({
        from: 'USD',
        to: 'USD',
        amount: 100,
        exchangeRate: 1,
        convertedAmount: 100,
      });
    });

    // 16. External API failure
    it('16. should return 502 when external API fails or times out', async () => {
      (currencyService.convert as jest.Mock).mockRejectedValueOnce(
        new BadGatewayException('Unable to retrieve the current exchange rate.'),
      );

      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: 100 })
        .expect(502);

      expect(res.body).toEqual({
        statusCode: 502,
        message: 'Unable to retrieve the current exchange rate.',
      });
    });

    // 17. Invalid external API response
    it('17. should return 502 when external API returns malformed response', async () => {
      (currencyService.convert as jest.Mock).mockRejectedValueOnce(
        new BadGatewayException('Unable to retrieve the current exchange rate.'),
      );

      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'XYZ', amount: 100 })
        .expect(502);

      expect(res.body).toEqual({
        statusCode: 502,
        message: 'Unable to retrieve the current exchange rate.',
      });
    });

    // 18. Database failure/error path
    it('18. should return 500 when database operation fails unexpectedly', async () => {
      (currencyService.convert as jest.Mock).mockRejectedValueOnce(
        new InternalServerErrorException('Failed to save conversion to database.'),
      );

      const res = await request(app.getHttpServer())
        .get('/currency/convert')
        .query({ from: 'USD', to: 'INR', amount: 100 })
        .expect(500);

      expect(res.body.statusCode).toBe(500);
      expect(res.body.message).toBe('Failed to save conversion to database.');
    });
  });

  describe('GET /currency/history', () => {
    // 11. Valid history request
    it('11. should return 200 and history data with default pagination', async () => {
      const mockResult = {
        data: [
          {
            id: 1,
            from: 'USD',
            to: 'INR',
            amount: 100,
            exchangeRate: 83.25,
            convertedAmount: 8325,
            createdAt: '2026-10-08T05:00:00.000Z',
          },
        ],
        pagination: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      };

      (currencyService.getHistory as jest.Mock).mockResolvedValueOnce(mockResult);

      const res = await request(app.getHttpServer())
        .get('/currency/history')
        .expect(200);

      expect(res.body).toEqual(mockResult);
    });

    // 12. History pagination
    it('12. should handle custom page and limit query parameters', async () => {
      const mockResult = {
        data: [],
        pagination: {
          total: 25,
          page: 2,
          limit: 10,
          totalPages: 3,
        },
      };

      (currencyService.getHistory as jest.Mock).mockResolvedValueOnce(mockResult);

      const res = await request(app.getHttpServer())
        .get('/currency/history')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(res.body).toEqual(mockResult);
      expect(currencyService.getHistory).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
      });
    });

    // 13. Invalid page
    it('13. should return 400 when page is less than 1 or not an integer', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/history')
        .query({ page: 0, limit: 10 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('page must be at least 1');
    });

    // 14. Invalid limit
    it('14. should return 400 when limit is less than 1 or not an integer', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/history')
        .query({ page: 1, limit: 0 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('limit must be at least 1');
    });

    // 15. Limit greater than allowed maximum
    it('15. should return 400 when limit exceeds 100', async () => {
      const res = await request(app.getHttpServer())
        .get('/currency/history')
        .query({ page: 1, limit: 150 })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(JSON.stringify(res.body.message)).toContain('limit cannot exceed 100');
    });
  });
});
