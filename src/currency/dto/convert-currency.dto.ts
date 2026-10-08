import { IsNotEmpty, IsNumber, IsPositive, IsString, Length, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ConvertCurrencyDto {
  @IsNotEmpty({ message: 'from currency is required' })
  @IsString({ message: 'from must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(3, 3, { message: 'from currency must be exactly 3 characters' })
  @Matches(/^[A-Z]{3}$/, { message: 'from currency must contain only alphabetic characters' })
  from: string;

  @IsNotEmpty({ message: 'to currency is required' })
  @IsString({ message: 'to must be a string' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(3, 3, { message: 'to currency must be exactly 3 characters' })
  @Matches(/^[A-Z]{3}$/, { message: 'to currency must contain only alphabetic characters' })
  to: string;

  @IsNotEmpty({ message: 'amount is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a valid number' })
  @IsPositive({ message: 'amount must be greater than 0' })
  amount: number;
}
