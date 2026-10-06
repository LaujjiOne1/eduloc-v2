import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorQueryDto {
  @IsOptional() @IsString()
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 20;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify([createdAt.toISOString(), id]), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as [string, string];
  return { createdAt: new Date(iso), id };
}
