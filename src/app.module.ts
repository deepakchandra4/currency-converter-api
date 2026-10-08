import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyModule } from './currency/currency.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CurrencyModule,
  ],
})
export class AppModule {}
