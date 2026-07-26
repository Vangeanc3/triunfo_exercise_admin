import type {
  ExerciseDocument,
  ExerciseDocumentOption,
} from '@/types/exercise';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TRIUNFO_API_URL ?? 'http://localhost:5197/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body.error === 'string'
        ? body.error
        : `Erro HTTP ${response.status}`;

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchExerciseDocumentOptions(): Promise<
  ExerciseDocumentOption[]
> {
  return requestJson<ExerciseDocumentOption[]>('/config/exercise-documents');
}

export async function fetchExerciseDocument(
  documentId: string,
): Promise<ExerciseDocument> {
  return requestJson<ExerciseDocument>(`/config/exercises/${documentId}`);
}

export async function saveExerciseDocument(
  documentId: string,
  data: ExerciseDocument,
) {
  await requestJson<{ message: string }>(`/config/exercises/${documentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadExerciseImage({
  documentId,
  scope,
  ownerId,
  file,
}: {
  documentId: string;
  scope: 'category' | 'document' | 'exercise' | 'variation';
  ownerId: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('documentId', documentId);
  formData.append('scope', scope);
  formData.append('ownerId', ownerId);
  formData.append('file', file);

  return requestJson<{ imageUrl: string }>('/config/assets/images', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteExerciseImage(imageUrl: string) {
  return requestJson<{ deleted: boolean }>(
    `/config/assets/images?imageUrl=${encodeURIComponent(imageUrl)}`,
    { method: 'DELETE' },
  );
}
