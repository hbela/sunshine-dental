import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/errors.js';

function serialize(d: any) {
  return {
    id: d.id,
    ownerId: d.ownerId,
    delegateId: d.delegateId,
    canView: d.canView,
    canEdit: d.canEdit,
    canBook: d.canBook,
    validFrom: d.validFrom ? d.validFrom.toISOString().split('T')[0] : null,
    validUntil: d.validUntil ? d.validUntil.toISOString().split('T')[0] : null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

/** True if `delegation` is within its validity window today (inclusive). */
function isCurrentlyValid(d: { validFrom: Date | null; validUntil: Date | null }): boolean {
  const today = new Date();
  if (d.validFrom && d.validFrom > today) return false;
  if (d.validUntil) {
    const end = new Date(d.validUntil);
    end.setUTCHours(23, 59, 59, 999);
    if (end < today) return false;
  }
  return true;
}

export interface CreateDelegationInput {
  ownerId: string;
  delegateId: string;
  canView?: boolean;
  canEdit?: boolean;
  canBook?: boolean;
  validFrom?: string;
  validUntil?: string;
}

export class DelegationService {
  /** Delegations owned by the user (as a provider) + received (as a delegate user). */
  static async forUser(userId: string) {
    const provider = await prisma.provider.findUnique({ where: { userId } });

    const owned = provider
      ? await prisma.calendarDelegation.findMany({
          where: { ownerId: provider.id },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const received = await prisma.calendarDelegation.findMany({
      where: { delegateId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      owned: owned.map(serialize),
      received: received.map(serialize),
    };
  }

  static async create(input: CreateDelegationInput) {
    const owner = await prisma.provider.findUnique({ where: { id: input.ownerId } });
    if (!owner) throw new HttpError(404, 'Owner provider not found');

    const delegate = await prisma.user.findUnique({ where: { id: input.delegateId } });
    if (!delegate) throw new HttpError(404, 'Delegate user not found');

    const delegation = await prisma.calendarDelegation.create({
      data: {
        ownerId: input.ownerId,
        delegateId: input.delegateId,
        canView: input.canView ?? true,
        canEdit: input.canEdit ?? false,
        canBook: input.canBook ?? false,
        validFrom: input.validFrom ? new Date(`${input.validFrom}T00:00:00.000Z`) : null,
        validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null,
      },
    });
    return serialize(delegation);
  }

  static async update(
    id: string,
    input: Partial<Pick<CreateDelegationInput, 'canView' | 'canEdit' | 'canBook' | 'validFrom' | 'validUntil'>>,
  ) {
    const existing = await prisma.calendarDelegation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Delegation not found');

    const data: any = {};
    if (input.canView !== undefined) data.canView = input.canView;
    if (input.canEdit !== undefined) data.canEdit = input.canEdit;
    if (input.canBook !== undefined) data.canBook = input.canBook;
    if (input.validFrom !== undefined) {
      data.validFrom = input.validFrom ? new Date(`${input.validFrom}T00:00:00.000Z`) : null;
    }
    if (input.validUntil !== undefined) {
      data.validUntil = input.validUntil ? new Date(`${input.validUntil}T00:00:00.000Z`) : null;
    }

    const delegation = await prisma.calendarDelegation.update({ where: { id }, data });
    return serialize(delegation);
  }

  static async remove(id: string) {
    const existing = await prisma.calendarDelegation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'Delegation not found');
    await prisma.calendarDelegation.delete({ where: { id } });
  }

  /**
   * Whether a user may manage (write to) a provider's calendar.
   * ADMIN: always. The owning PROVIDER: always. Otherwise: requires an active
   * delegation with canEdit (or canBook) inside its validity window.
   */
  static async canManageProviderCalendar(
    user: { id: string; role: string } | undefined,
    providerId: string,
  ): Promise<boolean> {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;

    const ownProfile = await prisma.provider.findUnique({ where: { userId: user.id } });
    if (ownProfile && ownProfile.id === providerId) return true;

    const delegations = await prisma.calendarDelegation.findMany({
      where: { ownerId: providerId, delegateId: user.id },
    });
    return delegations.some((d) => (d.canEdit || d.canBook) && isCurrentlyValid(d));
  }
}
