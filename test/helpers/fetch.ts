type MockResponseInit = {
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export const createMockResponse = ({ status = 200, headers = {}, body = {} }: MockResponseInit) => {
  const serializedBody = typeof body === 'string' ? body : JSON.stringify(body);

  return new Response(serializedBody, {
    status,
    headers,
  });
};

export const mockFetchOnce = (response: MockResponseInit) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(createMockResponse(response));
  return fetchMock;
};

export const mockFetchSequence = (responses: MockResponseInit[]) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(createMockResponse(response));
  }

  return fetchMock;
};
