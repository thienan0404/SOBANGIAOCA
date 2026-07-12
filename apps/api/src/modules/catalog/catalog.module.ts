import {Module} from '@nestjs/common';import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';import {CatalogController} from './catalog.controller';
@Module({controllers:[CatalogController],providers:[SupabaseAuthGuard]})export class CatalogModule{}
