import {Module} from '@nestjs/common';import {CatalogController} from './catalog.controller';import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';
@Module({controllers:[CatalogController],providers:[SupabaseAuthGuard]})export class CatalogModule{}
