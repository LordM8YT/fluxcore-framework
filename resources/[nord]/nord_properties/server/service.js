'use strict';

const crypto = require('node:crypto');
const { propertiesError } = require('./errors');

const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;
const PROPERTY_ID_PATTERN = /^[a-z][a-z0-9_]{1,47}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw propertiesError(
      response?.error?.code || 'INTEGRATION_ERROR',
      response?.error?.message || fallback,
    );
  }
  return response.data;
}

function distance(left, right) {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

class PropertiesService {
  constructor(database, config, integrations, runtime) {
    this.database = database;
    this.config = config;
    this.integrations = integrations;
    this.runtime = runtime;
    this.database.syncDefinitions(config.properties);
    this.database.clearStaleReservations(
      new Date(Date.now() - 5 * 60_000).toISOString(),
    );
  }

  definition(value) {
    const id = String(value || '').trim();
    if (!PROPERTY_ID_PATTERN.test(id) || !this.config.properties[id]) {
      throw propertiesError('PROPERTY_NOT_FOUND', 'property was not found');
    }
    return this.config.properties[id];
  }

  resolveOnline(identifier) {
    const player = this.integrations.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw propertiesError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.integrations.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw propertiesError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId, player };
  }

  requireNearby(source, definition, coordinates) {
    if (
      !coordinates ||
      distance(definition.entry, coordinates) > this.config.interactionDistance
    ) {
      throw propertiesError('TOO_FAR', 'player is too far from the property');
    }
  }

  publicProperty(entry, viewerCharacterId = null) {
    const definition = this.definition(entry.id);
    const access = viewerCharacterId
      ? this.database.hasAccess(entry.id, viewerCharacterId)
      : false;
    return {
      id: entry.id,
      label: definition.label,
      type: definition.type,
      price: definition.price,
      entry: clone(definition.entry),
      garageId: definition.garageId,
      owned: Boolean(entry.ownerCharacterId),
      isOwner: entry.ownerCharacterId === viewerCharacterId,
      hasAccess: access,
      locked: entry.locked,
      purchasedAt: entry.purchasedAt,
      keys:
        entry.ownerCharacterId === viewerCharacterId ? clone(entry.keys) : [],
    };
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    return {
      contract: 'varde.properties.bootstrap.v1',
      properties: this.database
        .list()
        .map((entry) => this.publicProperty(entry, online.characterId)),
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    this.runtime.emitClient(
      online.source,
      'varde_properties:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  syncAccessors(propertyId) {
    const current = this.database.get(propertyId);
    if (!current) return;
    const characters = new Set([
      current.ownerCharacterId,
      ...current.keys.map((entry) => entry.characterId),
    ]);
    for (const character of characters) {
      if (!character) continue;
      const source = Number(this.integrations.core.getPlayerSource(character));
      if (source > 0) {
        try {
          this.publish(source);
        } catch {}
      }
    }
  }

  ensureStash(definition) {
    return unwrap(
      this.integrations.inventory.registerStash(
        `property:${definition.id}`,
        `${definition.label} Storage`,
        definition.stash.slots,
        definition.stash.maxWeight,
      ),
      'property storage could not be registered',
    );
  }

  purchase(identifier, propertyId, coordinates) {
    const buyer = this.resolveOnline(identifier);
    const definition = this.definition(propertyId);
    this.requireNearby(buyer.source, definition, coordinates);
    this.ensureStash(definition);
    const token = crypto.randomUUID();
    const reference = `property:${definition.id}:${token}`;
    if (!this.database.reserve(definition.id, token)) {
      throw propertiesError('PROPERTY_UNAVAILABLE', 'property is already owned');
    }
    let charged = false;
    let ownershipCommitted = false;
    try {
      unwrap(
        this.integrations.core.removeMoney(
          buyer.source,
          this.config.currency,
          definition.price,
          'property_purchase',
          reference,
        ),
        'property payment was rejected',
      );
      charged = true;
      const purchased = this.database.finalize(
        definition.id,
        token,
        buyer.characterId,
        definition.price,
        reference,
      );
      if (!purchased) {
        throw propertiesError(
          'PROPERTY_RECONCILIATION_REQUIRED',
          'payment completed but ownership requires reconciliation',
        );
      }
      ownershipCommitted = true;
      try {
        this.publish(buyer.source);
      } catch (error) {
        try {
          this.runtime.log?.(
            'warn',
            `property ${definition.id} was purchased, but client sync failed: ${
              error?.message || String(error)
            }`,
          );
        } catch {}
      }
      return this.publicProperty(purchased, buyer.characterId);
    } catch (error) {
      if (charged && !ownershipCommitted) {
        unwrap(
          this.integrations.core.addMoney(
            buyer.source,
            this.config.currency,
            definition.price,
            'property_purchase_refund',
            reference,
          ),
          'property payment could not be refunded',
        );
      }
      if (!ownershipCommitted) {
        this.database.release(definition.id, token);
      }
      throw error;
    }
  }

  requireOwner(identifier, propertyId, coordinates) {
    const online = this.resolveOnline(identifier);
    const definition = this.definition(propertyId);
    this.requireNearby(online.source, definition, coordinates);
    const current = this.database.get(definition.id);
    if (current?.ownerCharacterId !== online.characterId) {
      throw propertiesError('FORBIDDEN', 'property ownership is required');
    }
    return { online, definition, current };
  }

  giveKey(identifier, propertyId, targetCharacterId, coordinates) {
    const owner = this.requireOwner(identifier, propertyId, coordinates);
    const targetId = String(targetCharacterId || '').trim();
    if (!CHARACTER_ID_PATTERN.test(targetId)) {
      throw propertiesError('VALIDATION_ERROR', 'target character id is invalid');
    }
    unwrap(
      this.integrations.core.getCharacterData(targetId),
      'target character was not found',
    );
    if (targetId === owner.online.characterId) {
      throw propertiesError('VALIDATION_ERROR', 'owner does not require a key');
    }
    const updated = this.database.addKey(
      owner.definition.id,
      targetId,
      owner.online.characterId,
    );
    this.syncAccessors(owner.definition.id);
    return this.publicProperty(updated, owner.online.characterId);
  }

  revokeKey(identifier, propertyId, targetCharacterId, coordinates) {
    const owner = this.requireOwner(identifier, propertyId, coordinates);
    const targetId = String(targetCharacterId || '').trim();
    if (!CHARACTER_ID_PATTERN.test(targetId)) {
      throw propertiesError('VALIDATION_ERROR', 'target character id is invalid');
    }
    const updated = this.database.removeKey(owner.definition.id, targetId);
    this.syncAccessors(owner.definition.id);
    return this.publicProperty(updated.property, owner.online.characterId);
  }

  setLocked(identifier, propertyId, locked, coordinates) {
    const online = this.resolveOnline(identifier);
    const definition = this.definition(propertyId);
    this.requireNearby(online.source, definition, coordinates);
    if (!this.database.hasAccess(definition.id, online.characterId)) {
      throw propertiesError('FORBIDDEN', 'property access is required');
    }
    const updated = this.database.setLocked(definition.id, Boolean(locked));
    if (!updated) {
      throw propertiesError('PROPERTY_UNAVAILABLE', 'property is not owned');
    }
    this.syncAccessors(definition.id);
    return this.publicProperty(updated, online.characterId);
  }

  openStorage(identifier, propertyId, coordinates) {
    const online = this.resolveOnline(identifier);
    const definition = this.definition(propertyId);
    this.requireNearby(online.source, definition, coordinates);
    if (!this.database.hasAccess(definition.id, online.characterId)) {
      throw propertiesError('FORBIDDEN', 'property access is required');
    }
    this.ensureStash(definition);
    return unwrap(
      this.integrations.inventory.openInventory(
        online.source,
        `property:${definition.id}`,
      ),
      'property storage could not be opened',
    );
  }

  hasAccess(identifier, propertyId) {
    const online = this.resolveOnline(identifier);
    const definition = this.definition(propertyId);
    return this.database.hasAccess(definition.id, online.characterId);
  }

  deleteCharacter(characterId) {
    return CHARACTER_ID_PATTERN.test(String(characterId))
      ? this.database.deleteCharacter(String(characterId))
      : { keys: 0, properties: 0 };
  }
}

module.exports = {
  PropertiesService,
  distance,
};
