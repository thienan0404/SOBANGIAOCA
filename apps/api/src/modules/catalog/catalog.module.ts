import {Module} from '@nestjs/common';import {SupabaseAuthGuard} from '../../common/guards/supabase-auth.guard';import {CatalogController} from './catalog.controller';
import {WorkSessionGuard} from '../../common/guards/work-session.guard';
@Module({controllers:[CatalogController],providers:[SupabaseAuthGuard,WorkSessionGuard]})export class CatalogModule{}
