'use strict';

const crypto = require('node:crypto');
const { worldError } = require('./errors');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw worldError(
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

class WorldService {
  constructor(database, config, integrations, runtime) {
    this.database = database;
    this.config = config;
    this.integrations = integrations;
    this.runtime = runtime;
    this.database.syncDoors(config.doors);
  }

  resolveOnline(identifier) {
    const player = this.integrations.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw worldError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.integrations.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw worldError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId, player };
  }

  requireNearby(definition, coordinates) {
    if (
      !coordinates ||
      Object.values(coordinates).some((value) => !Number.isFinite(Number(value))) ||
      distance(definition.position, coordinates) > this.config.interactionDistance
    ) {
      throw worldError('TOO_FAR', 'player is too far from the location');
    }
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    const doorStates = new Map(
      this.database.getDoors().map((entry) => [entry.id, entry]),
    );
    return {
      contract: 'Fluxcore.world.bootstrap.v1',
      shops: Object.values(this.config.shops).map((entry) => clone(entry)),
      dealerships: Object.values(this.config.dealerships).map((entry) =>
        clone(entry),
      ),
      doors: Object.values(this.config.doors).map((definition) => ({
        id: definition.id,
        label: definition.label,
        modelHash: definition.modelHash,
        position: clone(definition.position),
        locked:
          doorStates.get(definition.id)?.locked ?? definition.defaultLocked,
        canManage:
          definition.jobNames.includes(online.player.job?.name) &&
          online.player.job?.onDuty === true &&
          this.integrations.jobs.hasPermission(
            online.source,
            definition.permission,
            { requireDuty: true },
          ),
      })),
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    this.runtime.emitClient(
      online.source,
      'fluxcore_world:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  publishAll() {
    for (const player of this.integrations.core.getPlayers()) {
      try {
        this.publish(Number(player.source));
      } catch (error) {
        this.runtime.log('warn', error?.message || String(error));
      }
    }
  }

  recordPurchase(...values) {
    try {
      this.database.recordPurchase(...values);
    } catch (error) {
      this.runtime.log(
        'error',
        `purchase completed, but its audit entry failed: ${
          error?.message || String(error)
        }`,
      );
    }
  }

  shop(value) {
    const id = String(value || '').trim();
    const definition = this.config.shops[id];
    if (!definition) throw worldError('SHOP_NOT_FOUND', 'shop was not found');
    return definition;
  }

  dealership(value) {
    const id = String(value || '').trim();
    const definition = this.config.dealerships[id];
    if (!definition) {
      throw worldError('DEALERSHIP_NOT_FOUND', 'dealership was not found');
    }
    return definition;
  }

  door(value) {
    const id = String(value || '').trim();
    const definition = this.config.doors[id];
    if (!definition) throw worldError('DOOR_NOT_FOUND', 'door was not found');
    return definition;
  }

  buyItem(identifier, shopId, itemName, quantity, coordinates) {
    const buyer = this.resolveOnline(identifier);
    const shop = this.shop(shopId);
    this.requireNearby(shop, coordinates);
    const item = String(itemName || '').trim();
    const price = shop.items[item];
    const amount = Number(quantity);
    if (
      price === undefined ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > this.config.maximumPurchaseQuantity
    ) {
      throw worldError('VALIDATION_ERROR', 'shop purchase is invalid');
    }
    if (!this.integrations.inventory.canCarryItem(buyer.source, item, amount)) {
      throw worldError('INVENTORY_FULL', 'inventory cannot carry this purchase');
    }
    const total = price * amount;
    const reference = `shop:${shop.id}:${crypto.randomUUID()}`;
    unwrap(
      this.integrations.core.removeMoney(
        buyer.source,
        this.config.currency,
        total,
        'shop_purchase',
        reference,
      ),
      'shop payment was rejected',
    );
    try {
      unwrap(
        this.integrations.inventory.addItem(buyer.source, item, amount, {
          purchasedFrom: shop.id,
        }),
        'purchased items could not be added',
      );
    } catch (error) {
      unwrap(
        this.integrations.core.addMoney(
          buyer.source,
          this.config.currency,
          total,
          'shop_purchase_refund',
          reference,
        ),
        'shop payment could not be refunded',
      );
      throw error;
    }
    this.recordPurchase(
      'item',
      shop.id,
      buyer.characterId,
      item,
      amount,
      total,
      reference,
    );
    return { item, quantity: amount, total, reference };
  }

  buyVehicle(identifier, dealershipId, modelName, coordinates) {
    const buyer = this.resolveOnline(identifier);
    const dealership = this.dealership(dealershipId);
    this.requireNearby(dealership, coordinates);
    const model = String(modelName || '').trim().toLowerCase();
    const vehicle = dealership.vehicles[model];
    if (!vehicle) {
      throw worldError('VEHICLE_NOT_FOUND', 'dealership vehicle was not found');
    }
    const reference = `vehicle:${dealership.id}:${crypto.randomUUID()}`;
    unwrap(
      this.integrations.core.removeMoney(
        buyer.source,
        this.config.currency,
        vehicle.price,
        'vehicle_purchase',
        reference,
      ),
      'vehicle payment was rejected',
    );
    let registered;
    try {
      registered = unwrap(
        this.integrations.vehicles.registerOwnedVehicle(buyer.source, {
          model: vehicle.model,
          vehicleType: vehicle.type,
          garageId: dealership.garageId,
        }),
        'vehicle ownership could not be registered',
      );
    } catch (error) {
      unwrap(
        this.integrations.core.addMoney(
          buyer.source,
          this.config.currency,
          vehicle.price,
          'vehicle_purchase_refund',
          reference,
        ),
        'vehicle payment could not be refunded',
      );
      throw error;
    }
    this.recordPurchase(
      'vehicle',
      dealership.id,
      buyer.characterId,
      vehicle.model,
      1,
      vehicle.price,
      reference,
    );
    return {
      dealershipId: dealership.id,
      garageId: dealership.garageId,
      vehicle: registered,
      total: vehicle.price,
      reference,
    };
  }

  setDoorLocked(identifier, doorId, locked, coordinates) {
    const actor = this.resolveOnline(identifier);
    const definition = this.door(doorId);
    this.requireNearby(definition, coordinates);
    if (
      actor.player.job?.onDuty !== true ||
      !definition.jobNames.includes(actor.player.job?.name) ||
      !this.integrations.jobs.hasPermission(
        actor.source,
        definition.permission,
        { requireDuty: true },
      )
    ) {
      throw worldError(
        'FORBIDDEN',
        `on-duty permission ${definition.permission} is required`,
      );
    }
    const updated = this.database.setDoor(
      definition.id,
      Boolean(locked),
      actor.characterId,
    );
    if (!updated) throw worldError('DOOR_NOT_FOUND', 'door was not found');
    this.publishAll();
    return updated;
  }
}

module.exports = {
  WorldService,
  distance,
};
