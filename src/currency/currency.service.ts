import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@Injectable()
export class CurrencyService {
  private readonly apiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl =
      this.configService.get<string>('CURRENCY_API_URL') ||
      'https://open.er-api.com/v6/latest';
  }

  /**
   * Fetches the live exchange rate for a currency pair from the external API.
   * Enforces a 5-second timeout and translates upstream issues into 502 Bad Gateway.
   */
  async fetchExchangeRate(from: string, to: string): Promise<number> {
    const url = `${this.apiUrl.replace(/\/$/, '')}/${from}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new BadGatewayException('Unable to retrieve the current exchange rate.');
      }

      const data = await response.json();

      if (
        data?.result !== 'success' ||
        !data?.rates ||
        typeof data.rates[to] !== 'number'
      ) {
        throw new BadGatewayException('Unable to retrieve the current exchange rate.');
      }

      return data.rates[to];
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Unable to retrieve the current exchange rate.');
    }
  }

  /**
   * Performs currency conversion:
   * 1. Resolves exchange rate (1.0 for same-currency, or live external rate).
   * 2. Computes converted amount using Decimal arithmetic.
   * 3. Saves the conversion to PostgreSQL.
   * 4. Returns clean serialized JSON.
   */
  async convert(dto: ConvertCurrencyDto) {
    const from = dto.from.toUpperCase();
    const to = dto.to.toUpperCase();
    const amount = dto.amount;

    // Handle same-currency conversion directly without unnecessary network calls
    let exchangeRate: number;
    if (from === to) {
      exchangeRate = 1;
    } else {
      exchangeRate = await this.fetchExchangeRate(from, to);
    }

    const amountDecimal = new Prisma.Decimal(amount);
    const rateDecimal = new Prisma.Decimal(exchangeRate);
    const convertedDecimal = amountDecimal.mul(rateDecimal);

    try {
      const record = await this.prisma.conversionHistory.create({
        data: {
          from,
          to,
          amount: amountDecimal,
          exchangeRate: rateDecimal,
          convertedAmount: convertedDecimal,
        },
      });

      return {
        from: record.from,
        to: record.to,
        amount: Number(record.amount),
        exchangeRate: Number(record.exchangeRate),
        convertedAmount: Number(record.convertedAmount),
      };
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to save conversion to database.');
    }
  }

  /**
   * Retrieves paginated conversion history ordered by newest records first.
   */
  async getHistory(query: HistoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 10;
    const skip = (page - 1) * limit;

    try {
      const [records, total] = await Promise.all([
        this.prisma.conversionHistory.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.conversionHistory.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: records.map((record) => ({
          id: record.id,
          from: record.from,
          to: record.to,
          amount: Number(record.amount),
          exchangeRate: Number(record.exchangeRate),
          convertedAmount: Number(record.convertedAmount),
          createdAt: record.createdAt.toISOString(),
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve conversion history.');
    }
  }
}
