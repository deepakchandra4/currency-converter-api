import { Controller, Get, Query } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  /**
   * GET /currency/convert?from=USD&to=INR&amount=100
   * Converts currency using live exchange rates and logs the transaction.
   */
  @Get('convert')
  async convert(@Query() dto: ConvertCurrencyDto) {
    return this.currencyService.convert(dto);
  }

  /**
   * GET /currency/history?page=1&limit=10
   * Returns paginated conversion history sorted newest first.
   */
  @Get('history')
  async getHistory(@Query() query: HistoryQueryDto) {
    return this.currencyService.getHistory(query);
  }
}
