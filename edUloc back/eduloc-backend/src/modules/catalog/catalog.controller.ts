import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Public()
  @Get('subjects')
  subjects() {
    return this.service.subjects();
  }

  @Public()
  @Get('education-levels')
  levels() {
    return this.service.levels();
  }
}
