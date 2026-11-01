import {
  Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Put, Req, Res,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../core/config/app.config';
import { STORAGE_PROVIDER, StorageProvider } from './storage-provider.port';
import { LocalStorageProvider } from './local-storage.provider';

/**
 * Équivalent local des URL signées Supabase : PUT direct du fichier, GET signé pour la lecture.
 * Le jeton (HMAC, 15 min) tient lieu d'authentification, comme pour une URL signée Supabase.
 * N'est actif qu'avec STORAGE_DRIVER=local.
 */
@ApiExcludeController()
@Controller('dev-storage')
export class DevStorageController {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly cfg: AppConfig,
  ) {}

  private local(): LocalStorageProvider {
    if (!(this.storage instanceof LocalStorageProvider)) throw new NotFoundException();
    return this.storage;
  }

  @Public()
  @Put('upload/:token')
  async upload(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const local = this.local();
    let target: { file: string };
    try {
      target = local.resolveToken(token, 'upload');
    } catch {
      throw new ForbiddenException('UPLOAD_EXPIRED');
    }
    await local.prepareWrite(target.file);
    await pipeline(req, createWriteStream(target.file));
    await local.writeMime(target.file, String(req.headers['content-type'] ?? 'application/octet-stream').split(';')[0]);
    res.status(200).json({ Key: target.file });
  }

  /** Équivalent local d'un bucket Supabase PUBLIC : uniquement celui des photos de profil, chemin `<userId>/<fichier>`. */
  @Public()
  @Get('public/:bucket/:owner/:file')
  async readPublic(@Param('bucket') bucket: string, @Param('owner') owner: string, @Param('file') file: string, @Res() res: Response) {
    const local = this.local();
    if (bucket !== this.cfg.avatarsBucket) throw new NotFoundException();
    let path: string;
    try {
      path = local.fileFor(bucket, `${owner}/${file}`);
    } catch {
      throw new NotFoundException();
    }
    const mime = await local.readMime(path);
    if (mime) res.type(mime);
    res.sendFile(path, { headers: { 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': 'public, max-age=86400' } }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }

  @Public()
  @Get('object/:token')
  async read(@Param('token') token: string, @Res() res: Response) {
    const local = this.local();
    let target: { file: string };
    try {
      target = local.resolveToken(token, 'read');
    } catch {
      throw new ForbiddenException('UPLOAD_EXPIRED');
    }
    const mime = await local.readMime(target.file);
    if (mime) res.type(mime);
    // sendFile gère les requêtes Range (lecture audio / vidéo avec déplacement).
    res.sendFile(target.file, { headers: { 'Cross-Origin-Resource-Policy': 'cross-origin' } }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }
}
