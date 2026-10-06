import { Global, Module } from '@nestjs/common';
import { SupabaseStorageProvider } from './supabase-storage.provider';
import { STORAGE_PROVIDER } from './storage-provider.port';

@Global()
@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: SupabaseStorageProvider }],
  exports: [STORAGE_PROVIDER],
})
export class StorageInfrastructureModule {}
