'use strict';

const { businessesError } = require('./errors');

const BUSINESS_ID_PATTERN = /^biz_[a-f0-9]{16}$/u;
const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;
const NAME_PATTERN = /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 &'._-]{1,63}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function businessId(value) {
  const id = String(value || '').trim();
  if (!BUSINESS_ID_PATTERN.test(id)) {
    throw businessesError('VALIDATION_ERROR', 'business id is invalid');
  }
  return id;
}

function characterId(value) {
  const id = String(value || '').trim();
  if (!CHARACTER_ID_PATTERN.test(id)) {
    throw businessesError('VALIDATION_ERROR', 'character id is invalid');
  }
  return id;
}

function cleanName(value) {
  const name = String(value || '').trim().replace(/\s+/gu, ' ');
  if (!NAME_PATTERN.test(name)) {
    throw businessesError(
      'VALIDATION_ERROR',
      'business name must contain between 2 and 64 valid characters',
    );
  }
  return name;
}

function cleanReason(value) {
  const reason = String(value || 'business_transaction').trim();
  if (!reason || reason.length > 128) {
    throw businessesError(
      'VALIDATION_ERROR',
      'reason must contain between 1 and 128 characters',
    );
  }
  return reason;
}

class BusinessesService {
  constructor(database, config, core, runtime) {
    this.database = database;
    this.config = config;
    this.core = core;
    this.runtime = runtime;
  }

  resolveOnline(identifier) {
    const player = this.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw businessesError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw businessesError(
        'PLAYER_NOT_FOUND',
        'online player source was not found',
      );
    }
    return { source, characterId: player.characterId };
  }

  definition(type) {
    const name = String(type || '').trim().toLowerCase();
    const definition = this.config.types[name];
    if (!definition) {
      throw businessesError(
        'BUSINESS_TYPE_NOT_FOUND',
        'business type is not configured',
      );
    }
    return { name, definition };
  }

  decorate(entry) {
    const type = this.definition(entry.business.type).definition;
    const role = type.roles[entry.membership.role];
    if (!role) {
      throw businessesError(
        'ROLE_NOT_FOUND',
        `role ${entry.membership.role} is not configured`,
      );
    }
    const canViewTreasury =
      role.permissions.includes('*') ||
      role.permissions.includes('business.treasury.view');
    return {
      ...clone(entry.business),
      treasury: canViewTreasury ? entry.business.treasury : null,
      typeLabel: type.label,
      membership: {
        ...clone(entry.membership),
        roleLabel: role.label,
        permissions: [...role.permissions],
      },
    };
  }

  list(identifier) {
    const id =
      typeof identifier === 'string' && CHARACTER_ID_PATTERN.test(identifier)
        ? identifier
        : this.resolveOnline(identifier).characterId;
    return this.database.listForCharacter(id).map((entry) => this.decorate(entry));
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    const businesses = this.list(online.characterId);
    return {
      contract: 'Nord.businesses.bootstrap.v1',
      businesses,
      activeBusiness:
        businesses.find((entry) => entry.membership.active) || null,
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    const active = snapshot.activeBusiness;
    this.runtime.setPlayerState(
      online.source,
      'Nord:business',
      active
        ? {
            id: active.id,
            type: active.type,
            name: active.name,
            role: active.membership.role,
          }
        : null,
      true,
    );
    this.runtime.emitClient(
      online.source,
      'nord_businesses:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  syncIfOnline(id) {
    const source = Number(this.core.getPlayerSource(id));
    if (source > 0 && this.core.getPlayerData(source)) {
      return this.publish(source);
    }
    return null;
  }

  create(identifier, type, name, actor = 'resource') {
    const owner = this.resolveOnline(identifier);
    const definition = this.definition(type);
    const created = this.database.create(
      definition.name,
      cleanName(name),
      owner.characterId,
      actor,
    );
    this.publish(owner.source);
    return created;
  }

  membership(identifier, id) {
    const online = this.resolveOnline(identifier);
    const membership = this.database.getMember(
      businessId(id),
      online.characterId,
    );
    if (!membership) {
      throw businessesError(
        'MEMBERSHIP_NOT_FOUND',
        'business membership was not found',
      );
    }
    return { online, membership };
  }

  hasPermission(identifier, id, permission) {
    try {
      const context = this.membership(identifier, id);
      const company = this.database.get(context.membership.businessId);
      const role = this.definition(company.type).definition.roles[
        context.membership.role
      ];
      return Boolean(
        role &&
          (role.permissions.includes('*') ||
            role.permissions.includes(String(permission || ''))),
      );
    } catch {
      return false;
    }
  }

  requirePermission(identifier, id, permission) {
    const context = this.membership(identifier, id);
    if (!this.hasPermission(identifier, id, permission)) {
      throw businessesError(
        'FORBIDDEN',
        `business permission ${permission} is required`,
      );
    }
    return context;
  }

  addMember(identifier, id, targetId, role, actor = 'player') {
    const context = this.requirePermission(
      identifier,
      id,
      'business.members.manage',
    );
    const company = this.database.get(context.membership.businessId);
    const roleName = String(role || '').trim().toLowerCase();
    if (!this.definition(company.type).definition.roles[roleName]) {
      throw businessesError('ROLE_NOT_FOUND', 'business role is not configured');
    }
    if (roleName === 'owner') {
      throw businessesError(
        'OWNER_ROLE_PROTECTED',
        'the owner role cannot be assigned',
      );
    }
    const target = characterId(targetId);
    const existing = this.database.getMember(company.id, target);
    if (
      !existing &&
      this.database.countMemberships(target) >= this.config.maximumMemberships
    ) {
      throw businessesError(
        'MEMBERSHIP_LIMIT_REACHED',
        'character has reached the business membership limit',
      );
    }
    const membership = this.database.setMember(
      company.id,
      target,
      roleName,
      actor,
    );
    this.syncIfOnline(target);
    return membership;
  }

  removeMember(identifier, id, targetId, actor = 'player') {
    const context = this.requirePermission(
      identifier,
      id,
      'business.members.manage',
    );
    const company = this.database.get(context.membership.businessId);
    const target = characterId(targetId);
    if (company.ownerCharacterId === target) {
      throw businessesError(
        'OWNER_ROLE_PROTECTED',
        'the business owner cannot be removed',
      );
    }
    if (!this.database.removeMember(company.id, target, actor)) {
      throw businessesError(
        'MEMBERSHIP_NOT_FOUND',
        'business membership was not found',
      );
    }
    this.syncIfOnline(target);
    return true;
  }

  setActive(identifier, id, actor = 'player') {
    const online = this.resolveOnline(identifier);
    this.database.setActive(businessId(id), online.characterId, actor);
    return this.publish(online.source);
  }

  changeTreasury(id, value, operation, reason, reference, actor = 'resource') {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw businessesError(
        'VALIDATION_ERROR',
        'treasury amount must be a positive integer',
      );
    }
    const balance = this.database.changeTreasury(
      businessId(id),
      operation === 'debit' ? -amount : amount,
      this.config.maximumTreasury,
      cleanReason(reason),
      reference,
      actor,
    );
    for (const membership of this.database.listMembers(businessId(id))) {
      this.syncIfOnline(membership.characterId);
    }
    return balance;
  }

  get(id) {
    const company = this.database.get(businessId(id));
    if (!company) {
      throw businessesError('BUSINESS_NOT_FOUND', 'business was not found');
    }
    return company;
  }

  ledger(identifier, id, limit = 50) {
    this.requirePermission(identifier, id, 'business.treasury.view');
    const validLimit = Number(limit);
    if (!Number.isSafeInteger(validLimit) || validLimit < 1 || validLimit > 200) {
      throw businessesError(
        'VALIDATION_ERROR',
        'ledger limit must be between 1 and 200',
      );
    }
    return this.database.ledger(businessId(id), validLimit);
  }

  deleteCharacter(id) {
    return CHARACTER_ID_PATTERN.test(String(id))
      ? this.database.deleteCharacter(String(id))
      : { disabled: 0, memberships: 0 };
  }
}

module.exports = {
  BusinessesService,
  businessId,
  characterId,
  cleanName,
};
