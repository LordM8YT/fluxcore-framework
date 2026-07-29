'use strict';

const crypto = require('node:crypto');
const { fuelError } = require('./errors');

function coordinates(value) {
  const result = {
    x: Number(value?.x ?? value?.[0]),
    y: Number(value?.y ?? value?.[1]),
    z: Number(value?.z ?? value?.[2]),
  };
  if (![result.x, result.y, result.z].every(Number.isFinite)) {
    throw fuelError('POSITION_UNAVAILABLE', 'entity position is unavailable');
  }
  return result;
}

function distance(left, right) {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
  );
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw fuelError(
      response?.error?.code || 'CORE_ERROR',
      response?.error?.message || fallback,
    );
  }
  return response.data;
}

class FuelService {
  constructor(config, core, runtime) {
    this.config = config;
    this.core = core;
    this.runtime = runtime;
  }

  liters(value) {
    const liters = Math.round(Number(value) * 10) / 10;
    if (
      !Number.isFinite(liters) ||
      liters < this.config.minimumLiters ||
      liters > this.config.maximumLiters
    ) {
      throw fuelError(
        'LITERS_INVALID',
        `liters must be between ${this.config.minimumLiters} and ${this.config.maximumLiters}`,
      );
    }
    return liters;
  }

  station(value) {
    const station = this.config.stations[String(value || '')];
    if (!station) {
      throw fuelError('STATION_NOT_FOUND', 'fuel station was not found');
    }
    return station;
  }

  purchase(source, networkId, stationId, requestedLiters) {
    const player = this.core.getPlayerData(source);
    if (!player?.characterId) {
      throw fuelError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const ped = this.runtime.playerPed(source);
    const vehicle = this.runtime.vehicleFromNetwork(networkId);
    if (this.runtime.entityType(vehicle) !== 2) {
      throw fuelError('VEHICLE_INVALID', 'network entity is not a vehicle');
    }
    if (
      distance(
        coordinates(this.runtime.entityCoordinates(ped)),
        coordinates(this.runtime.entityCoordinates(vehicle)),
      ) > this.config.vehicleDistance
    ) {
      throw fuelError(
        'VEHICLE_DISTANCE',
        'you must stand next to the vehicle',
      );
    }

    const station = this.station(stationId);
    if (
      distance(coordinates(this.runtime.entityCoordinates(vehicle)), station) >
      station.radius + 2
    ) {
      throw fuelError('STATION_REQUIRED', 'vehicle is not at this fuel station');
    }

    const liters = this.liters(requestedLiters);
    const cost = Math.ceil(liters * this.config.pricePerLiter);
    const reference = `fuel:${crypto.randomUUID()}`;
    unwrap(
      this.core.removeMoney(
        source,
        this.config.currency,
        cost,
        'fuel_purchase',
        reference,
      ),
      'fuel payment was rejected',
    );

    return {
      networkId: Number(networkId),
      stationId: station.id,
      liters,
      cost,
      currency: this.config.currency,
      reference,
    };
  }

  useCan(source, networkId) {
    const player = this.core.getPlayerData(source);
    if (!player?.characterId) {
      throw fuelError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const ped = this.runtime.playerPed(source);
    const vehicle = this.runtime.vehicleFromNetwork(networkId);
    if (this.runtime.entityType(vehicle) !== 2) {
      throw fuelError('VEHICLE_INVALID', 'network entity is not a vehicle');
    }
    if (
      distance(
        coordinates(this.runtime.entityCoordinates(ped)),
        coordinates(this.runtime.entityCoordinates(vehicle)),
      ) > this.config.vehicleDistance
    ) {
      throw fuelError(
        'VEHICLE_DISTANCE',
        'you must stand next to the vehicle',
      );
    }
    unwrap(
      this.runtime.removeItem(source, 'fuel_can', 1),
      'a fuel can is required',
    );
    return {
      networkId: Number(networkId),
      liters: this.config.fuelCanLiters,
      cost: 0,
      currency: this.config.currency,
      reference: `fuel_can:${crypto.randomUUID()}`,
      usedCan: true,
    };
  }

  buyCan(source, stationId) {
    const player = this.core.getPlayerData(source);
    if (!player?.characterId) {
      throw fuelError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const ped = this.runtime.playerPed(source);
    const station = this.station(stationId);
    if (
      distance(coordinates(this.runtime.entityCoordinates(ped)), station) >
      station.radius + 2
    ) {
      throw fuelError('STATION_REQUIRED', 'you are not at this fuel station');
    }
    if (this.runtime.canCarryItem(source, 'fuel_can', 1) !== true) {
      throw fuelError(
        'INVENTORY_FULL',
        'there is no room for a fuel can',
      );
    }
    const reference = `fuel_can_purchase:${crypto.randomUUID()}`;
    unwrap(
      this.core.removeMoney(
        source,
        this.config.currency,
        this.config.fuelCanPrice,
        'fuel_can_purchase',
        reference,
      ),
      'fuel can payment was rejected',
    );
    const added = this.runtime.addItem(source, 'fuel_can', 1, {
      liters: this.config.fuelCanLiters,
    });
    if (!added || added.ok !== true) {
      this.core.addMoney(
        source,
        this.config.currency,
        this.config.fuelCanPrice,
        'fuel_can_refund',
        reference,
      );
      unwrap(added, 'the fuel can could not be added');
    }
    return {
      item: 'fuel_can',
      liters: this.config.fuelCanLiters,
      cost: this.config.fuelCanPrice,
      currency: this.config.currency,
      reference,
    };
  }
}

module.exports = {
  FuelService,
  coordinates,
  distance,
};
