/**
 * Base repository pattern (ADR-0005, ADR-0002)
 * All data access goes through typed repositories
 * Services own transactions
 */

import { Knex } from 'knex';
import { Logger, LogContext } from '@infrastructure/logger';

export interface RepositoryOptions {
  logger?: Logger;
  correlationId?: string;
}

/**
 * Update payload: any subset of the entity's fields.
 * `null` is allowed per-field to clear a nullable column.
 */
export type EntityUpdate<T> = { [K in keyof T]?: T[K] | null };

/**
 * Abstract base repository for all domain entities
 * Implements basic CRUD + query patterns
 */
export abstract class Repository<T> {
  protected logger: Logger;
  protected table: string;

  constructor(
    protected qb: Knex,
    table: string,
    options?: RepositoryOptions
  ) {
    this.table = table;
    const logContext: LogContext = {};
    if (options?.correlationId) {
      logContext.correlationId = options.correlationId;
    }
    if (options?.logger) {
      this.logger = options.logger;
    } else {
      this.logger = new Logger(logContext);
    }
  }

  /**
   * Get by ID (strong-typed)
   */
  async getById(id: string): Promise<T | null> {
    this.logger.debug(`Repository.getById: ${this.table}`, { id });

    try {
      const result = await this.qb(this.table).where('id', id).first();
      return (result as T) || null;
    } catch (error) {
      this.logger.error(`Repository.getById failed: ${this.table}`, error as Error);
      throw error;
    }
  }

  /**
   * Get all (with optional where clause)
   */
  async getAll(where?: Record<string, unknown>): Promise<T[]> {
    this.logger.debug(`Repository.getAll: ${this.table}`, { where });

    try {
      let query = this.qb(this.table);
      if (where) {
        query = query.where(where);
      }
      const results = await query;
      return (results as T[]) || [];
    } catch (error) {
      this.logger.error(`Repository.getAll failed: ${this.table}`, error as Error);
      throw error;
    }
  }

  /**
   * Create (insert)
   */
  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<T>): Promise<T> {
    this.logger.debug(`Repository.create: ${this.table}`, {
      entity: Object.keys(entity as object),
    });

    try {
      const now = new Date().toISOString();
      const record = {
        ...entity,
        createdAt: now,
        updatedAt: now,
      };

      await this.qb(this.table).insert(record);
      // Refetch to ensure we return fresh data
      const created = await this.getById((entity as { id?: string }).id || (record as any).id);
      if (!created) {
        throw new Error('Failed to retrieve created record');
      }
      return created;
    } catch (error) {
      this.logger.error(`Repository.create failed: ${this.table}`, error as Error);
      throw error;
    }
  }

  /**
   * Update
   */
  async update(id: string, updates: EntityUpdate<T>): Promise<T> {
    this.logger.debug(`Repository.update: ${this.table}`, {
      id,
      fields: Object.keys(updates as object),
    });

    try {
      const now = new Date().toISOString();
      await this.qb(this.table)
        .where('id', id)
        .update({
          ...updates,
          updatedAt: now,
        });

      const updated = await this.getById(id);
      if (!updated) {
        throw new Error(`Record not found after update: ${id}`);
      }
      return updated;
    } catch (error) {
      this.logger.error(`Repository.update failed: ${this.table}`, error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete
   */
  async delete(id: string): Promise<void> {
    this.logger.debug(`Repository.delete: ${this.table}`, { id });

    try {
      await this.qb(this.table).where('id', id).delete();
    } catch (error) {
      this.logger.error(`Repository.delete failed: ${this.table}`, error as Error, { id });
      throw error;
    }
  }

  /**
   * Bulk operations
   */
  async bulkCreate(
    entities: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<T>>
  ): Promise<T[]> {
    this.logger.debug(`Repository.bulkCreate: ${this.table}`, { count: entities.length });

    try {
      const now = new Date().toISOString();
      const records = entities.map((entity) => ({
        ...entity,
        createdAt: now,
        updatedAt: now,
      }));

      await this.qb(this.table).insert(records);
      return records as T[];
    } catch (error) {
      this.logger.error(`Repository.bulkCreate failed: ${this.table}`, error as Error);
      throw error;
    }
  }

  /**
   * Count records (for pagination, parity testing)
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    this.logger.debug(`Repository.count: ${this.table}`, { where });

    try {
      let query = this.qb(this.table);
      if (where) {
        query = query.where(where);
      }
      const result = await query.count('* as count').first();
      return (result as any).count || 0;
    } catch (error) {
      this.logger.error(`Repository.count failed: ${this.table}`, error as Error);
      throw error;
    }
  }
}
