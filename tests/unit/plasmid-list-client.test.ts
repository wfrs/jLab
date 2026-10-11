/**
 * @jest-environment jsdom
 *
 * listPlasmids must return the whole library even though the API caps a
 * page at MAX_PAGE_SIZE (regression: the plasmid grid showed only the first
 * 50 rows of a larger library).
 */

import { listPlasmids } from '@/components/plasmids/api-client';
import { MAX_PAGE_SIZE } from '@/shared/pagination';

const TOTAL = MAX_PAGE_SIZE * 2 + 7;

function plasmidsFrom(offset: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${offset + i}`,
    name: `p${offset + i}`,
  }));
}

/** jsdom has no Response global; the client only reads these members. */
function envelope(body: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    statusText: status < 400 ? 'OK' : 'Internal Server Error',
    json: async () => body,
  } as unknown as Response;
}

describe('listPlasmids client paging', () => {
  const fetchMock = jest.fn<Promise<Response>, [string]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  function serveLibrary(total: number) {
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      const count = Math.max(0, Math.min(limit, total - offset));
      return envelope({ data: { data: plasmidsFrom(offset, count), total, limit, offset } });
    });
  }

  it('fetches every page and concatenates them in order', async () => {
    serveLibrary(TOTAL);

    const result = await listPlasmids();

    expect(result.total).toBe(TOTAL);
    expect(result.data).toHaveLength(TOTAL);
    expect(result.data[0].name).toBe('p0');
    expect(result.data[TOTAL - 1].name).toBe(`p${TOTAL - 1}`);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const offsets = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get('offset'));
    expect(offsets).toEqual(['0', String(MAX_PAGE_SIZE), String(MAX_PAGE_SIZE * 2)]);
  });

  it('issues a single request when the library fits in one page', async () => {
    serveLibrary(3);

    const result = await listPlasmids();

    expect(result.data).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list without extra requests', async () => {
    serveLibrary(0);

    const result = await listPlasmids();

    expect(result.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('forwards the search query to every page request', async () => {
    serveLibrary(MAX_PAGE_SIZE + 1);

    await listPlasmids('gfp');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) {
      expect(new URL(url).searchParams.get('search')).toBe('gfp');
    }
  });

  it('surfaces the server error message when a page fails', async () => {
    fetchMock.mockResolvedValue(
      envelope({ message: 'database unavailable', code: 'DB_DOWN', category: 'INTERNAL' }, 500)
    );

    await expect(listPlasmids()).rejects.toThrow('database unavailable');
  });
});
