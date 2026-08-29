/**
 * Integration Tests: Attachments + GenBank (services and API routes)
 * Legacy parity: BLOB attachments per plasmid (upload/download/delete),
 * one GenBank file per plasmid (.gb/.gbk gate, replace-on-import).
 */

import { Knex } from 'knex';
import { randomUUID } from 'crypto';
import { AttachmentService } from '@services/attachment.service';
import { GenbankService } from '@services/genbank.service';
import { PlasmidService } from '@services/plasmid.service';
import { setQueryBuilder } from '@infrastructure/query-builder';
import { createTestDb, createTestSchema, cleanTestDb } from '../helpers/test-db';

type PlasmidAttachmentsRoute = typeof import('@app/api/plasmids/[id]/attachments/route');
type AttachmentRoute = typeof import('@app/api/attachments/[id]/route');
type GenbankRoute = typeof import('@app/api/plasmids/[id]/genbank/route');

let plasmidAttachmentsRoute: PlasmidAttachmentsRoute;
let attachmentRoute: AttachmentRoute;
let genbankRoute: GenbankRoute;
let attachmentService: AttachmentService;
let genbankService: GenbankService;
let plasmidService: PlasmidService;
let db: Knex;

const asNextRequest = (req: Request) => req as never;

const GB_CONTENT = 'LOCUS       pTest0001               5000 bp    DNA     circular\nORIGIN\n//\n';

function fileUploadRequest(
  url: string,
  method: string,
  filename: string,
  content: Buffer | string,
  mimeType = 'application/octet-stream'
): Request {
  const formData = new FormData();
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  formData.append('file', new File([new Uint8Array(bytes)], filename, { type: mimeType }));
  return new Request(url, { method, body: formData });
}

async function createPlasmid(name: string): Promise<string> {
  const plasmid = await plasmidService.createPlasmid({ id: randomUUID(), name });
  return plasmid.id;
}

describe('Attachments + GenBank (Integration)', () => {
  beforeAll(async () => {
    db = createTestDb();
    setQueryBuilder(db);
    await createTestSchema(db);
    attachmentService = new AttachmentService();
    genbankService = new GenbankService();
    plasmidService = new PlasmidService();

    plasmidAttachmentsRoute = await import('@app/api/plasmids/[id]/attachments/route');
    attachmentRoute = await import('@app/api/attachments/[id]/route');
    genbankRoute = await import('@app/api/plasmids/[id]/genbank/route');
  });

  afterAll(async () => {
    await db.destroy();
    setQueryBuilder(null);
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe('AttachmentService', () => {
    it('stores a file and returns metadata without the payload', async () => {
      const plasmidId = await createPlasmid('pAtt001');
      const data = Buffer.from([0, 1, 2, 253, 254, 255]);

      const meta = await attachmentService.createAttachment({
        plasmidId,
        filename: 'seq result.ab1',
        mimeType: 'application/octet-stream',
        data,
      });

      expect(meta.filename).toBe('seq result.ab1');
      expect(meta.sizeBytes).toBe(6);
      expect(meta).not.toHaveProperty('data');

      const full = await attachmentService.getAttachment(meta.id);
      expect(Buffer.from(full.data).equals(data)).toBe(true);
    });

    it('rejects empty files and missing plasmids', async () => {
      const plasmidId = await createPlasmid('pAtt002');

      await expect(
        attachmentService.createAttachment({
          plasmidId,
          filename: 'empty.txt',
          data: Buffer.alloc(0),
        })
      ).rejects.toMatchObject({ code: 'VALIDATION' });

      await expect(
        attachmentService.createAttachment({
          plasmidId: 'nope',
          filename: 'x.txt',
          data: Buffer.from('x'),
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists metadata per plasmid without payloads', async () => {
      const plasmidId = await createPlasmid('pAtt003');
      await attachmentService.createAttachment({
        plasmidId,
        filename: 'a.pdf',
        data: Buffer.from('AAA'),
      });
      await attachmentService.createAttachment({
        plasmidId,
        filename: 'b.pdf',
        data: Buffer.from('BBBB'),
      });

      const list = await attachmentService.listPlasmidAttachments(plasmidId);
      expect(list).toHaveLength(2);
      expect(list.map((a) => a.filename).sort()).toEqual(['a.pdf', 'b.pdf']);
      for (const item of list) {
        expect(item).not.toHaveProperty('data');
      }

      await expect(attachmentService.listPlasmidAttachments('nope')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('Attachments API', () => {
    it('uploads via multipart, downloads the exact bytes, then deletes', async () => {
      const plasmidId = await createPlasmid('pAtt004');
      const bytes = Buffer.from([1, 2, 3, 200, 100, 0, 7]);

      const uploadResponse = await plasmidAttachmentsRoute.POST(
        asNextRequest(
          fileUploadRequest(
            `http://localhost/api/plasmids/${plasmidId}/attachments`,
            'POST',
            'trace.ab1',
            bytes
          )
        ),
        { params: { id: plasmidId } }
      );
      expect(uploadResponse.status).toBe(201);
      const uploaded = (await uploadResponse.json()).data;
      expect(uploaded.filename).toBe('trace.ab1');
      expect(uploaded.sizeBytes).toBe(bytes.length);

      const listResponse = await plasmidAttachmentsRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/attachments`)),
        { params: { id: plasmidId } }
      );
      expect((await listResponse.json()).data).toHaveLength(1);

      const downloadResponse = await attachmentRoute.GET(
        asNextRequest(new Request(`http://localhost/api/attachments/${uploaded.id}`)),
        { params: { id: uploaded.id } }
      );
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get('content-disposition')).toContain('trace.ab1');
      const body = Buffer.from(await downloadResponse.arrayBuffer());
      expect(body.equals(bytes)).toBe(true);

      const deleteResponse = await attachmentRoute.DELETE(
        asNextRequest(
          new Request(`http://localhost/api/attachments/${uploaded.id}`, { method: 'DELETE' })
        ),
        { params: { id: uploaded.id } }
      );
      expect(deleteResponse.status).toBe(200);
      expect(await db('attachments').count('* as c').first()).toMatchObject({ c: 0 });
    });

    it('returns 400 without a file field and 404 for unknown ids', async () => {
      const plasmidId = await createPlasmid('pAtt005');

      const badUpload = await plasmidAttachmentsRoute.POST(
        asNextRequest(
          new Request(`http://localhost/api/plasmids/${plasmidId}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
        ),
        { params: { id: plasmidId } }
      );
      expect(badUpload.status).toBe(400);

      const missingDownload = await attachmentRoute.GET(
        asNextRequest(new Request('http://localhost/api/attachments/nope')),
        { params: { id: 'nope' } }
      );
      expect(missingDownload.status).toBe(404);
    });
  });

  describe('GenbankService', () => {
    it('enforces the legacy .gb/.gbk extension gate', async () => {
      const plasmidId = await createPlasmid('pGb001');

      await expect(
        genbankService.setFile({ plasmidId, filename: 'seq.txt', content: GB_CONTENT })
      ).rejects.toMatchObject({
        code: 'VALIDATION',
        message: 'File must have .gb or .gbk extension',
      });

      const gbk = await genbankService.setFile({
        plasmidId,
        filename: 'seq.gbk',
        content: GB_CONTENT,
      });
      expect(gbk.filename).toBe('seq.gbk');
    });

    it('stores, replaces in place, and deletes', async () => {
      const plasmidId = await createPlasmid('pGb002');

      expect(await genbankService.getMeta(plasmidId)).toBeNull();

      await genbankService.setFile({ plasmidId, filename: 'v1.gb', content: GB_CONTENT });
      const replaced = await genbankService.setFile({
        plasmidId,
        filename: 'v2.gb',
        content: GB_CONTENT + '\n',
      });
      expect(replaced.filename).toBe('v2.gb');
      expect(await db('genbank_files').count('* as c').first()).toMatchObject({ c: 1 });

      const file = await genbankService.getFile(plasmidId);
      expect(file.content).toBe(GB_CONTENT + '\n');

      await genbankService.deleteFile(plasmidId);
      expect(await genbankService.getMeta(plasmidId)).toBeNull();
      await expect(genbankService.getFile(plasmidId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('GenBank API', () => {
    it('uploads (PUT), reads metadata, downloads with the stored filename', async () => {
      const plasmidId = await createPlasmid('pGb003');

      const putResponse = await genbankRoute.PUT(
        asNextRequest(
          fileUploadRequest(
            `http://localhost/api/plasmids/${plasmidId}/genbank`,
            'PUT',
            'pGb003.gb',
            GB_CONTENT,
            'text/plain'
          )
        ),
        { params: { id: plasmidId } }
      );
      expect(putResponse.status).toBe(200);
      expect((await putResponse.json()).data.filename).toBe('pGb003.gb');

      const metaResponse = await genbankRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/genbank`)),
        { params: { id: plasmidId } }
      );
      const meta = (await metaResponse.json()).data;
      expect(meta.filename).toBe('pGb003.gb');
      expect(meta.sizeBytes).toBe(Buffer.byteLength(GB_CONTENT, 'utf8'));
      expect(meta).not.toHaveProperty('content');

      const downloadResponse = await genbankRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/genbank?download=1`)),
        { params: { id: plasmidId } }
      );
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get('content-disposition')).toContain('pGb003.gb');
      expect(await downloadResponse.text()).toBe(GB_CONTENT);
    });

    it('rejects wrong extensions with 400 and download of a missing file with 404', async () => {
      const plasmidId = await createPlasmid('pGb004');

      const badPut = await genbankRoute.PUT(
        asNextRequest(
          fileUploadRequest(
            `http://localhost/api/plasmids/${plasmidId}/genbank`,
            'PUT',
            'notes.docx',
            'hello'
          )
        ),
        { params: { id: plasmidId } }
      );
      expect(badPut.status).toBe(400);

      const missingDownload = await genbankRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/genbank?download=1`)),
        { params: { id: plasmidId } }
      );
      expect(missingDownload.status).toBe(404);

      const metaResponse = await genbankRoute.GET(
        asNextRequest(new Request(`http://localhost/api/plasmids/${plasmidId}/genbank`)),
        { params: { id: plasmidId } }
      );
      expect(metaResponse.status).toBe(200);
      expect((await metaResponse.json()).data).toBeNull();
    });
  });

  describe('Plasmid delete cascade', () => {
    it('removes attachments and the GenBank file with the plasmid', async () => {
      const plasmidId = await createPlasmid('pCascade');
      await attachmentService.createAttachment({
        plasmidId,
        filename: 'doc.pdf',
        data: Buffer.from('PDF'),
      });
      await genbankService.setFile({ plasmidId, filename: 'pCascade.gb', content: GB_CONTENT });

      await plasmidService.deletePlasmid(plasmidId);

      expect(await db('attachments').count('* as c').first()).toMatchObject({ c: 0 });
      expect(await db('genbank_files').count('* as c').first()).toMatchObject({ c: 0 });
    });
  });
});
