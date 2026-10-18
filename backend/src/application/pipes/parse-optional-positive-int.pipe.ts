import { Injectable, type PipeTransform } from '@nestjs/common';
import { ParsePositiveIntPipe } from './parse-positive-int.pipe';

@Injectable()
export class ParseOptionalPositiveIntPipe implements PipeTransform {
  private readonly required = new ParsePositiveIntPipe();

  transform(value: unknown): number | undefined {
    return value === undefined ? undefined : this.required.transform(value);
  }
}
