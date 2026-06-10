export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: { field?: string; message: string }[];
};

type ApiInit = RequestInit & {
  _retry?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          return false;
        }

        const payload = (await response.json()) as ApiEnvelope<unknown>;
        return payload.success;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function parseEnvelope<T>(response: Response) {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Réponse serveur invalide (${response.status})`);
  }
}

export async function api<T>(input: RequestInfo | URL, init?: ApiInit) {
  const response = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401 && !init?._retry) {
    const refreshed = await tryRefreshSession();

    if (refreshed) {
      return api<T>(input, { ...init, _retry: true });
    }
  }

  const payload = await parseEnvelope<T>(response);

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data;
}
