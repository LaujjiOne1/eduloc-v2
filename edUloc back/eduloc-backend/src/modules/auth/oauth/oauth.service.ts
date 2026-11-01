import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RateLimitService } from '../../../common/rate-limit.service';
import { AuthService } from '../auth.service';
import { IdentityResolver, type ResolveInput } from './identity-resolver';
import { type KnownUser, decideOAuthSignIn } from './oauth-decision';
import type { OAuthIdentity } from './oauth-identity';

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string } | null)?.code === 'P2002';

/** Prénom de secours quand le fournisseur n'en donne pas (Apple ne le donne qu'à la toute première connexion). */
function fallbackFirstName(email: string): string {
  const local = email.split('@')[0]?.replace(/[^\p{L}\p{N}]+/gu, ' ').trim() ?? '';
  return local ? local.charAt(0).toUpperCase() + local.slice(1, 100) : 'Utilisateur';
}

/**
 * Connexion sociale (Google, Apple, Facebook) branchée sur l'authentification EduLoc existante.
 *
 * Le fournisseur ne fait que PROUVER l'identité ; la session reste celle d'EduLoc (jeton d'accès + jeton de rafraîchissement
 * renouvelé, révocation, coffre de l'appareil…). L'application envoie le jeton obtenu auprès du fournisseur, le serveur le
 * vérifie lui-même (`IdentityResolver`) puis applique `decideOAuthSignIn` : lier à un compte existant, ou en créer un.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: IdentityResolver,
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async exchange(input: ResolveInput, ip: string) {
    await this.rateLimit.consume(`rl:oauth:${ip}`, 20, 900);
    const identity = await this.resolver.resolve(input);

    // Deux connexions simultanées d'un même nouveau compte peuvent se disputer l'unicité (e-mail ou fournisseur) : on relit une fois.
    let result: { userId: string; created: boolean };
    try {
      result = await this.resolve(identity);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      result = await this.resolve(identity);
    }
    const user = await this.prisma.user.update({ where: { id: result.userId }, data: { lastLoginAt: new Date() } });
    return { ...(await this.auth.openSession(user)), created: result.created };
  }

  private async resolve(identity: OAuthIdentity): Promise<{ userId: string; created: boolean }> {
    const linkedRow = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.providerUserId } },
      include: { user: true },
    });
    const emailOwnerRow = !linkedRow && identity.email ? await this.prisma.user.findUnique({ where: { email: identity.email } }) : null;
    const known = (u: { id: string; status: KnownUser['status']; deletedAt: Date | null; isAdmin: boolean } | null | undefined): KnownUser | null =>
      u ? { id: u.id, status: u.status, deletedAt: u.deletedAt, isAdmin: u.isAdmin } : null;

    const decision = decideOAuthSignIn({ linked: known(linkedRow?.user), emailOwner: known(emailOwnerRow), identity });

    switch (decision.action) {
      case 'reject':
        if (decision.code === 'ACCOUNT_DISABLED' || decision.code === 'OAUTH_LINK_FORBIDDEN') throw new ForbiddenException(decision.code);
        throw new UnprocessableEntityException(decision.code);

      case 'login':
        if (decision.activate) await this.activateOp(decision.userId);
        return { userId: decision.userId, created: false };

      case 'link':
        await this.prisma.$transaction([
          this.prisma.oAuthAccount.create({
            data: { userId: decision.userId, provider: identity.provider, providerUserId: identity.providerUserId, email: identity.email },
          }),
          ...(decision.activate ? [this.activateOp(decision.userId)] : []),
        ]);
        return { userId: decision.userId, created: false };

      case 'create': {
        const email = identity.email as string; // garanti par la décision (e-mail présent et attesté)
        const user = await this.prisma.user.create({
          data: {
            firstName: (identity.firstName ?? fallbackFirstName(email)).slice(0, 100),
            lastName: (identity.lastName ?? '').slice(0, 100),
            email,
            password: null,
            status: 'ACTIVE',
            emailVerified: true,
            oauthAccounts: { create: { provider: identity.provider, providerUserId: identity.providerUserId, email } },
          },
        });
        return { userId: user.id, created: true };
      }
    }
  }

  /**
   * Compte jamais vérifié, désormais attesté par le fournisseur : il devient actif, et son mot de passe est EFFACÉ, car il
   * a pu être posé par quelqu'un qui n'avait pas accès à la boîte mail (inscription lancée avec l'e-mail d'autrui).
   */
  private activateOp(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE', emailVerified: true, password: null, emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
    });
  }
}
