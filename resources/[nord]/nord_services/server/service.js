'use strict';

const crypto = require('node:crypto');
const { servicesError } = require('./errors');

const CHARACTER_ID_PATTERN = /^vrd_[a-f0-9]{16}$/u;
const INVOICE_ID_PATTERN = /^inv_[a-f0-9]{16}$/u;
const BUSINESS_ID_PATTERN = /^biz_[a-f0-9]{16}$/u;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unwrap(response, fallback) {
  if (!response || response.ok !== true) {
    throw servicesError(
      response?.error?.code || 'INTEGRATION_ERROR',
      response?.error?.message || fallback,
    );
  }
  return response.data;
}

function cleanDescription(value) {
  const description = String(value || '').trim().replace(/\s+/gu, ' ');
  if (!description || description.length > 256) {
    throw servicesError(
      'VALIDATION_ERROR',
      'description must contain between 1 and 256 characters',
    );
  }
  return description;
}

function invoiceId(value) {
  const id = String(value || '').trim();
  if (!INVOICE_ID_PATTERN.test(id)) {
    throw servicesError('VALIDATION_ERROR', 'invoice id is invalid');
  }
  return id;
}

class ServicesService {
  constructor(database, config, integrations, runtime) {
    this.database = database;
    this.config = config;
    this.integrations = integrations;
    this.runtime = runtime;
  }

  resolveOnline(identifier) {
    const player = this.integrations.core.getPlayerData(identifier);
    if (!player?.characterId) {
      throw servicesError('PLAYER_NOT_FOUND', 'online player was not found');
    }
    const source = Number(
      typeof identifier === 'number' || /^\d+$/u.test(String(identifier))
        ? identifier
        : this.integrations.core.getPlayerSource(player.characterId),
    );
    if (!Number.isSafeInteger(source) || source <= 0) {
      throw servicesError('PLAYER_NOT_FOUND', 'online player source was not found');
    }
    return { source, characterId: player.characterId, player };
  }

  service(name) {
    const id = String(name || '').trim().toLowerCase();
    const definition = this.config.services[id];
    if (!definition) {
      throw servicesError(
        'SERVICE_NOT_FOUND',
        'service is not configured',
      );
    }
    return { id, definition };
  }

  requireStaff(identifier, serviceName) {
    const online = this.resolveOnline(identifier);
    const service = this.service(serviceName);
    if (
      !service.definition.jobNames.includes(online.player.job?.name) ||
      online.player.job?.onDuty !== true ||
      !this.integrations.jobs.hasPermission(
        online.source,
        service.definition.invoicePermission,
        { requireDuty: true },
      )
    ) {
      throw servicesError(
        'FORBIDDEN',
        `on-duty permission ${service.definition.invoicePermission} is required`,
      );
    }
    return { online, service };
  }

  amount(service, value) {
    const amount = Number(value);
    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > service.definition.maximumInvoice
    ) {
      throw servicesError(
        'VALIDATION_ERROR',
        `invoice amount must be between 1 and ${service.definition.maximumInvoice}`,
      );
    }
    return amount;
  }

  createInvoice(
    identifier,
    serviceName,
    recipientIdentifier,
    value,
    description,
    businessId = null,
  ) {
    const staff = this.requireStaff(identifier, serviceName);
    const recipient = this.resolveOnline(recipientIdentifier);
    if (recipient.characterId === staff.online.characterId) {
      throw servicesError(
        'VALIDATION_ERROR',
        'an invoice cannot be issued to the same character',
      );
    }
    let targetBusiness = null;
    if (businessId !== null && businessId !== undefined && businessId !== '') {
      targetBusiness = String(businessId);
      if (!BUSINESS_ID_PATTERN.test(targetBusiness)) {
        throw servicesError('VALIDATION_ERROR', 'business id is invalid');
      }
      if (
        !this.integrations.businesses.hasPermission(
          staff.online.source,
          targetBusiness,
          'business.sales',
        )
      ) {
        throw servicesError(
          'FORBIDDEN',
          'business.sales permission is required',
        );
      }
    }
    const invoice = this.database.create(
      staff.service.id,
      staff.online.characterId,
      recipient.characterId,
      targetBusiness,
      this.amount(staff.service, value),
      cleanDescription(description),
    );
    this.publish(recipient.source);
    this.publish(staff.online.source);
    return invoice;
  }

  snapshot(identifier) {
    const online = this.resolveOnline(identifier);
    const issued = this.database.forIssuer(
      online.characterId,
      this.config.historyLimit,
    );
    const received = this.database.forRecipient(
      online.characterId,
      this.config.historyLimit,
    );
    return {
      contract: 'varde.services.bootstrap.v1',
      invoices: {
        issued: clone(issued),
        received: clone(received),
      },
      roster: this.roster(),
    };
  }

  publish(identifier) {
    const online = this.resolveOnline(identifier);
    const snapshot = this.snapshot(online.source);
    this.runtime.emitClient(
      online.source,
      'varde_services:client:update',
      clone(snapshot),
    );
    return snapshot;
  }

  syncIfOnline(characterId) {
    const source = Number(this.integrations.core.getPlayerSource(characterId));
    if (source > 0 && this.integrations.core.getPlayerData(source)) {
      return this.publish(source);
    }
    return null;
  }

  roster() {
    const output = {};
    for (const service of Object.keys(this.config.services)) {
      output[service] = [];
    }
    for (const player of this.integrations.core.getPlayers()) {
      if (player.job?.onDuty !== true) {
        continue;
      }
      for (const [name, definition] of Object.entries(this.config.services)) {
        if (definition.jobNames.includes(player.job?.name)) {
          output[name].push({
            source: Number(player.source),
            characterId: player.characterId,
            name: `${player.profile?.firstName || ''} ${
              player.profile?.lastName || ''
            }`.trim(),
            job: clone(player.job),
          });
        }
      }
    }
    return output;
  }

  getInvoice(id) {
    const invoice = this.database.get(invoiceId(id));
    if (!invoice) {
      throw servicesError('INVOICE_NOT_FOUND', 'invoice was not found');
    }
    return invoice;
  }

  pay(identifier, id) {
    const payer = this.resolveOnline(identifier);
    const invoice = this.getInvoice(id);
    if (invoice.recipientCharacterId !== payer.characterId) {
      throw servicesError('FORBIDDEN', 'invoice does not belong to this character');
    }
    if (invoice.status !== 'pending') {
      throw servicesError(
        'INVOICE_NOT_PENDING',
        'invoice is no longer pending',
      );
    }

    const reference = `invoice:${invoice.id}:${crypto.randomUUID()}`;
    const claimed = this.database.claim(invoice.id, reference);
    if (!claimed) {
      throw servicesError(
        'INVOICE_NOT_PENDING',
        'invoice is no longer pending',
      );
    }

    let paymentCommitted = false;
    try {
      if (invoice.businessId) {
        unwrap(
          this.integrations.core.removeMoney(
            payer.source,
            this.config.currency,
            invoice.amount,
            'service_invoice',
            reference,
          ),
          'core rejected the invoice payment',
        );
        try {
          unwrap(
            this.integrations.businesses.creditTreasury(
              invoice.businessId,
              invoice.amount,
              'service_invoice',
              reference,
            ),
            'business rejected the invoice payment',
          );
        } catch (error) {
          unwrap(
            this.integrations.core.addMoney(
              payer.source,
              this.config.currency,
              invoice.amount,
              'service_invoice_refund',
              reference,
            ),
            'core could not refund a failed business invoice',
          );
          throw error;
        }
      } else {
        unwrap(
          this.integrations.core.transferMoney(
            payer.source,
            invoice.issuerCharacterId,
            this.config.currency,
            invoice.amount,
            'service_invoice',
            reference,
          ),
          'core rejected the invoice transfer',
        );
      }
      paymentCommitted = true;
      const paid = this.database.markPaid(invoice.id);
      if (!paid) {
        throw servicesError(
          'INVOICE_RECONCILIATION_REQUIRED',
          'payment completed but invoice state requires reconciliation',
        );
      }
      this.publish(payer.source);
      this.syncIfOnline(invoice.issuerCharacterId);
      return paid;
    } catch (error) {
      if (
        !paymentCommitted &&
        this.database.get(invoice.id)?.status === 'processing'
      ) {
        this.database.reset(invoice.id);
      }
      throw error;
    }
  }

  cancel(identifier, id) {
    const actor = this.resolveOnline(identifier);
    const invoice = this.getInvoice(id);
    if (invoice.issuerCharacterId !== actor.characterId) {
      throw servicesError(
        'FORBIDDEN',
        'only the invoice issuer may cancel it',
      );
    }
    const cancelled = this.database.cancel(invoice.id);
    if (!cancelled) {
      throw servicesError(
        'INVOICE_NOT_PENDING',
        'invoice is no longer pending',
      );
    }
    this.publish(actor.source);
    this.syncIfOnline(invoice.recipientCharacterId);
    return cancelled;
  }

  deleteCharacter(characterId) {
    return CHARACTER_ID_PATTERN.test(String(characterId))
      ? this.database.deleteCharacter(String(characterId))
      : 0;
  }
}

module.exports = {
  ServicesService,
  cleanDescription,
  invoiceId,
};
