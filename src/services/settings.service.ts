/**
 * SettingsService
 * Single-row application/user settings (legacy Settings table).
 * getSettings auto-creates the default row; updates are partial.
 *
 * Legacy note: initials were "intended as immutable after first setup"
 * because upload folder naming depends on them. v2 keeps them editable
 * until the integrations milestone; the UI notes the file-naming impact.
 */

import { getQueryBuilder } from '@infrastructure/query-builder';
import { Settings, DomainError } from '@domain/types';
import { Logger } from '@infrastructure/logger';

/** Singleton row id */
const SETTINGS_ID = 'default';

export interface UpdateSettingsInput {
  name?: string;
  initials?: string;
  email?: string;
  institution?: string;
  duplicateGmos?: boolean;
}

export class SettingsService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /**
   * Get the settings row, creating the default one on first access
   */
  async getSettings(): Promise<Settings> {
    this.logger.info('SettingsService.getSettings');

    try {
      const db = getQueryBuilder();
      const existing = await db('settings').where('id', SETTINGS_ID).first();
      if (existing) {
        return existing as Settings;
      }

      const now = new Date().toISOString();
      await db('settings').insert({
        id: SETTINGS_ID,
        name: '',
        initials: '',
        email: '',
        institution: process.env.JLAB_INSTITUTION || '',
        duplicateGmos: false,
        createdAt: now,
        updatedAt: now,
      });

      this.logger.info('SettingsService.getSettings created default row');
      return (await db('settings').where('id', SETTINGS_ID).first()) as Settings;
    } catch (error) {
      this.logger.error('SettingsService.getSettings failed', error as Error);
      throw new DomainError('DATABASE', 'Failed to load settings', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Partially update the settings row
   */
  async updateSettings(updates: UpdateSettingsInput): Promise<Settings> {
    this.logger.info('SettingsService.updateSettings', { fields: Object.keys(updates) });

    // Ensure the row exists before updating
    await this.getSettings();

    try {
      const db = getQueryBuilder();
      await db('settings')
        .where('id', SETTINGS_ID)
        .update({ ...updates, updatedAt: new Date().toISOString() });

      const updated = (await db('settings').where('id', SETTINGS_ID).first()) as Settings;

      this.logger.info('SettingsService.updateSettings succeeded', {
        fields: Object.keys(updates),
      });

      return updated;
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      this.logger.error('SettingsService.updateSettings failed', error as Error, { updates });
      throw new DomainError('DATABASE', 'Failed to update settings', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
