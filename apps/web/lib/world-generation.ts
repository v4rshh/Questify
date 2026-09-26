import { fetchApi } from './api';

<<<<<<< HEAD
export interface GenerationStatus {
  status: string;
  progress: number;
  message: string;
}

export async function generateWorld<T>(
  course: string,
  material: string,
  onProgress: (status: GenerationStatus) => void,
): Promise<T> {
  let status = await fetchApi<GenerationStatus>(`/learning/courses/${course}/world/generation`, {
    method: 'POST',
    body: JSON.stringify({ material_id: material }),
  });
  for (;;) {
    onProgress(status);
    if (status.status === 'completed')
      return fetchApi<T>(`/learning/courses/${course}/world?material_id=${material}`);
    if (status.status === 'failed') throw new Error(status.message);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    status = await fetchApi<GenerationStatus>(
      `/learning/courses/${course}/materials/${material}/generation`,
    );
=======
export interface GenerationStatus { status: string; progress: number; message: string; }

export async function generateWorld<T>(course: string, material: string, onProgress: (status: GenerationStatus) => void): Promise<T> {
  let status = await fetchApi<GenerationStatus>(`/learning/courses/${course}/world/generation`, {
    method: 'POST', body: JSON.stringify({ material_id: material }),
  });
  for (;;) {
    onProgress(status);
    if (status.status === 'completed') return fetchApi<T>(`/learning/courses/${course}/world?material_id=${material}`);
    if (status.status === 'failed') throw new Error(status.message);
    await new Promise(resolve => setTimeout(resolve, 2500));
    status = await fetchApi<GenerationStatus>(`/learning/courses/${course}/materials/${material}/generation`);
>>>>>>> 87fe0b65fb36913b41c48bd554f447f5624b9a7f
  }
}
